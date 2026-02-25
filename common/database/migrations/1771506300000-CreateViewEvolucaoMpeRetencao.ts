import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewEvolucaoMpeRetencao1771506300000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_evolucao_mpe_retencao
            AS SELECT l.razao_social AS nome_empresa,
                l.cnpj::text AS cnpj,
                l.porte_empresa,
                    CASE
                        WHEN l.cnae IS NULL THEN 'Não informado'::text
                        WHEN l.cnae::text = ''::text THEN 'Não informado'::text
                        ELSE replace(replace(l.cnae::text, E'\\r'::text, ' '::text), E'\\n'::text, ' '::text)
                    END AS cnae,
                l.uf,
                COALESCE(lc.plan_name, 'sem plano'::character varying) AS plano,
                u.name AS contato,
                l.cpf_original::text AS cpf,
                u.email,
                u.phone AS telefone_do_usuario,
                audit_summary.primeiro_login AS primeiro_login_amei,
                audit_summary.ultimo_login AS ultimo_login_amei,
                l.created_at AS vinculo_cnpj,
                audit_summary.quantidade_acessos AS logins_acumulados,
                diagnosis_summary.inicio_autodiagnostico AS primeiro_diagnostico_automatico,
                diagnosis_summary.inicio_autodiagnostico AS inicio_audodiagnostico,
                diagnosis_summary.fim_autodiagnostico,
                docs_summary.primeiro_upload AS primeira_evidencia,
                    CASE
                        WHEN survey_data.retry = true THEN 'Está em nova tentativa. Não existe a informação no banco'::text
                        ELSE 'Não está em tentativa'::text
                    END AS status_finalizacao_eixos,
                eixos_conclusao.conclusao_eixo_env,
                eixos_conclusao.conclusao_eixo_gov,
                eixos_conclusao.conclusao_eixo_soc,
                survey_data.form_sent_at AS finalizacao_eixos,
                    CASE
                        WHEN COALESCE(audit_badges.primeiro_badge_level, 'sem selo'::character varying::text) = 'tematico'::text THEN 'reconhecimento inicial'::text
                        ELSE COALESCE(audit_badges.primeiro_badge_level, 'sem selo'::character varying::text)
                    END AS primeiro_selo,
                audit_badges.primeiro_badge AS data_primeiro_selo,
                    CASE
                        WHEN survey_data.badge_level IS NULL THEN NULL::timestamp with time zone
                        ELSE
                        CASE
                            WHEN survey_data.badge_level::text = 'sem selo'::text THEN NULL::timestamp with time zone
                            ELSE COALESCE(survey_data.form_sent_at, survey_data.created_at::timestamp with time zone)
                        END
                    END AS data_selo_ultima_confirmacao,
                    CASE
                        WHEN COALESCE(survey_data.badge_level, 'sem selo'::character varying)::text = 'tematico'::text THEN 'reconhecimento inicial'::character varying
                        ELSE COALESCE(survey_data.badge_level, 'sem selo'::character varying)
                    END AS selo_ultima_confirmacao
            FROM dados_externos.vw_mapeamento_licenca_porte_mpe l
                LEFT JOIN LATERAL (
                    SELECT DISTINCT ON ("user".cpf::text) "user".cpf::text AS cpf,
                        "user".name,
                        "user".email,
                        "user".phone::text AS phone
                    FROM "user"
                    WHERE "user".cpf::text = l.cpf_original::text
                    ORDER BY "user".cpf::text, "user".created_at
                ) u ON true
                LEFT JOIN LATERAL (
                    SELECT DISTINCT ON (c.cnpj) s.id,
                        s.created_at,
                        s.badge_level,
                        s.form_sent_at,
                        s.retry,
                        c.id AS c_id
                    FROM "biud-esg".companies c
                        JOIN "biud-esg".surveys s ON c.id = s.company_id
                    WHERE c.cnpj::text = l.cnpj::text
                    ORDER BY c.cnpj, s.created_at DESC
                ) survey_data ON true
                LEFT JOIN LATERAL (
                    SELECT DISTINCT ON (licenses.company_id) licenses.plan_name,
                        licenses.subscription_date
                    FROM "biud-esg".licenses
                    WHERE licenses.company_id = survey_data.c_id
                    ORDER BY licenses.company_id, licenses.subscription_date DESC
                ) lc ON true
                LEFT JOIN (
                    SELECT audit_logs.username::text AS username,
                        min(audit_logs.operation_timestamp) AS primeiro_login,
                        max(audit_logs.operation_timestamp) AS ultimo_login,
                        count(*) AS quantidade_acessos
                    FROM "biud-esg".audit_logs
                    GROUP BY audit_logs.username::text
                ) audit_summary ON u.email::text = audit_summary.username
                LEFT JOIN (
                    SELECT answer_diagnosis.survey_id,
                        min(answer_diagnosis.created_at) AS inicio_autodiagnostico,
                        max(answer_diagnosis.created_at) AS fim_autodiagnostico
                    FROM "biud-esg".answer_diagnosis
                    WHERE answer_diagnosis.update_count = 1
                    GROUP BY answer_diagnosis.survey_id
                ) diagnosis_summary ON survey_data.id = diagnosis_summary.survey_id
                LEFT JOIN (
                    SELECT question_documents.survey_id,
                        question_documents.company_id,
                        min(question_documents.uploaded_at) AS primeiro_upload
                    FROM "biud-esg".question_documents
                    GROUP BY question_documents.survey_id, question_documents.company_id
                ) docs_summary ON survey_data.id = docs_summary.survey_id
                    AND survey_data.c_id = docs_summary.company_id
                LEFT JOIN LATERAL (
                    SELECT DISTINCT ON (survey_audit.survey_id) survey_audit.badge_level::text AS primeiro_badge_level,
                        survey_audit.created_at AS primeiro_badge
                    FROM "biud-esg".survey_audit
                    WHERE survey_audit.survey_id = survey_data.id
                        AND survey_audit.badge_level IS NOT NULL
                    ORDER BY survey_audit.survey_id, survey_audit.created_at
                ) audit_badges ON true
                LEFT JOIN (
                    SELECT a.company_id,
                        a.id AS survey_id,
                        max(b.created_at) FILTER (WHERE a.env_completed AND q.tag::text ~~* 'ENV%'::text) AS conclusao_eixo_env,
                        max(b.created_at) FILTER (WHERE a.gov_completed AND q.tag::text ~~* 'GOV%'::text) AS conclusao_eixo_gov,
                        max(b.created_at) FILTER (WHERE a.social_completed AND q.tag::text ~~* 'SOC%'::text) AS conclusao_eixo_soc
                    FROM "biud-esg".surveys a
                        LEFT JOIN "biud-esg".answer_options b ON a.company_id = b.company_id
                            AND a.id = b.survey_id
                        LEFT JOIN "biud-esg".questions q ON b.question_id = q.id
                    GROUP BY a.company_id, a.id
                ) eixos_conclusao ON survey_data.c_id = eixos_conclusao.company_id
                    AND survey_data.id = eixos_conclusao.survey_id;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_evolucao_mpe_retencao;`);
    }
}
