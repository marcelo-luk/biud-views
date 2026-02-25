import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewEvolucaoMpeJornada1771506100000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_evolucao_mpe_jornada
            AS SELECT l.cpf,
                u.name AS nome_do_usuario,
                u.phone::text AS telefone_do_usuario,
                u.email AS email_do_usuario,
                l.cnpj::text AS cnpj,
                l.razao_social,
                    CASE
                        WHEN l.cnae IS NULL THEN 'Não informado'::text
                        WHEN l.cnae::text = ''::text THEN 'Não informado'::text
                        ELSE replace(replace(l.cnae::text, E'\\r'::text, ' '::text), E'\\n'::text, ' '::text)
                    END AS cnae,
                l.created_at AS empresa_cadastrada_em,
                l.uf,
                l.porte_empresa,
                    CASE
                        WHEN survey_data.created_at IS NULL THEN 'Nao iniciada'::text
                        ELSE survey_data.created_at::text
                    END AS pesquisa_iniciada_em,
                    CASE
                        WHEN survey_data.diagnosis_completed IS TRUE THEN 'Sim'::text
                        WHEN survey_data.diagnosis_completed IS FALSE THEN 'Incompleto'::text
                        ELSE 'Nao iniciado'::text
                    END AS respondeu_diagnostico,
                    CASE
                        WHEN survey_data.passed_diagnosis IS TRUE THEN 'Aprovada'::text
                        WHEN survey_data.passed_diagnosis IS FALSE THEN 'Reprovada'::text
                        ELSE 'Nao finalizado'::text
                    END AS aprovada_diagnostico,
                    CASE
                        WHEN survey_data.env_completed IS TRUE THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'bronze'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'prata'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'ouro'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'diamante'::text THEN 'Completo'::text
                        ELSE 'Nao iniciada'::text
                    END AS eixo_ambiental_completo,
                    CASE
                        WHEN survey_data.social_completed IS TRUE THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'bronze'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'prata'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'ouro'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'diamante'::text THEN 'Completo'::text
                        ELSE 'Nao iniciada'::text
                    END AS eixo_social_completo,
                    CASE
                        WHEN survey_data.gov_completed IS TRUE THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'bronze'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'prata'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'ouro'::text THEN 'Completo'::text
                        WHEN survey_data.badge_level::text = 'diamante'::text THEN 'Completo'::text
                        ELSE 'Nao iniciada'::text
                    END AS eixo_governanca_completo,
                    CASE
                        WHEN survey_data.step IS NULL THEN 0
                        ELSE survey_data.step
                    END AS tentativas,
                    CASE
                        WHEN survey_data.total_score IS NULL THEN 0
                        ELSE survey_data.total_score
                    END AS pontuacao_total,
                    CASE
                        WHEN survey_data.badge_level::text = 'Reconhecimento Inicial'::text THEN 'Reconhecimento inicial'::character varying
                        WHEN survey_data.badge_level::text = 'tematico'::text THEN 'Reconhecimento inicial'::character varying
                        WHEN survey_data.badge_level IS NULL THEN 'Sem selo'::character varying
                        ELSE survey_data.badge_level
                    END AS nivel_selo,
                l.subscription_date,
                l.plan_name
            FROM dados_externos.vw_mapeamento_licenca_porte_mpe l
                LEFT JOIN "biud-esg"."user" u ON u.cpf::text = l.cpf_original::text
                    AND u.id = (
                        SELECT max(x.id) AS max
                        FROM "biud-esg"."user" x
                        WHERE x.cpf::text = u.cpf::text
                    )
                LEFT JOIN (
                    SELECT s.id,
                        s.name,
                        s.step,
                        s.passed_diagnosis,
                        s.active,
                        s.created_at,
                        s.total_score,
                        s.certificate_number,
                        s.badge_level,
                        s.env_completed,
                        s.social_completed,
                        s.gov_completed,
                        s.diagnosis_completed,
                        s.certificate_qrcode,
                        s.company_id,
                        s.form_sent,
                        s.retry,
                        s.axis_scores,
                        s.check_progress,
                        s.general_status,
                        s.form_sent_at,
                        c.cnpj
                    FROM "biud-esg".companies c
                        LEFT JOIN "biud-esg".surveys s ON c.id = s.company_id
                ) survey_data ON survey_data.cnpj::text = l.cnpj::text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_evolucao_mpe_jornada;`);
    }
}
