import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewBatimentos1771505263454 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
                CREATE OR REPLACE VIEW public.vw_batimento
                AS WITH base AS (
                        SELECT mc.cnpj,
                            mc.name AS nome_empresa,
                            mc.created_at,
                            mc.uf,
                            u.id AS user_id,
                            u.name AS contato,
                            u.cpf,
                            u.email,
                            u.phone,
                            c.id AS company_id,
                            c.size,
                            c.cpe_return,
                            c.created_at::timestamp(0) without time zone AS business_created_at,
                            mc.subscription_date
                        FROM vw_monitoramento_de_cadastrados mc
                            JOIN "biud-esg".companies c ON c.cnpj::text = mc.cnpj::text
                            LEFT JOIN "biud-esg".user_companies uc ON c.id = uc.company_id
                            LEFT JOIN "biud-esg"."user" u ON u.id = uc.user_id
                        ), survey_latest AS (
                        SELECT t.id,
                            t.name,
                            t.step,
                            t.passed_diagnosis,
                            t.active,
                            t.created_at,
                            t.total_score,
                            t.certificate_number,
                            t.badge_level,
                            t.env_completed,
                            t.social_completed,
                            t.gov_completed,
                            t.diagnosis_completed,
                            t.certificate_qrcode,
                            t.company_id,
                            t.form_sent,
                            t.retry,
                            t.axis_scores,
                            t.check_progress,
                            t.general_status,
                            t.form_sent_at,
                            t.rn
                        FROM ( SELECT s.id,
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
                                    row_number() OVER (PARTITION BY s.company_id ORDER BY s.id DESC) AS rn
                                FROM "biud-esg".surveys s
                                WHERE s.active = true) t
                        WHERE t.rn = 1
                        ), qd_agg AS (
                        SELECT qd_1.survey_id,
                            min(qd_1.uploaded_at) AS inicio_diagnostico,
                            max(qd_1.uploaded_at) AS fim_diagnostico
                        FROM "biud-esg".question_documents qd_1
                        GROUP BY qd_1.survey_id
                        ), best_answer AS (
                        SELECT DISTINCT ON (x.survey_id, x.question_id) x.survey_id,
                            x.question_id,
                            x.resposta
                        FROM ( SELECT s.id AS survey_id,
                                    q1.id AS question_id,
                                    ao.option::text AS resposta,
                                    3 AS prio
                                FROM survey_latest s
                                    JOIN "biud-esg".answer_options ao ON ao.survey_id = s.id AND ao.selected
                                    JOIN "biud-esg".questions q1 ON q1.id = ao.question_id AND q1.tag::text <> 'diagnosis'::text
                                UNION ALL
                                SELECT s.id,
                                    q1.id,
                                        CASE
                                            WHEN a.response_boolean THEN 'sim'::text
                                            ELSE 'não'::text
                                        END AS resposta,
                                    2 AS prio
                                FROM survey_latest s
                                    JOIN "biud-esg".answers a ON a.survey_id = s.id
                                    JOIN "biud-esg".questions q1 ON q1.id = a.question_id AND q1.tag::text <> 'diagnosis'::text
                                UNION ALL
                                SELECT ad_1.survey_id,
                                    q1.id AS question_id,
                                        CASE
                                            WHEN unp.answer THEN 'sim'::text
                                            ELSE 'não'::text
                                        END AS resposta,
                                    1 AS prio
                                FROM survey_latest s
                                    JOIN "biud-esg".answer_diagnosis ad_1 ON ad_1.survey_id = s.id
                                    CROSS JOIN LATERAL ( VALUES (1,ad_1.q1), (2,ad_1.q2), (3,ad_1.q3), (4,ad_1.q4), (5,ad_1.q5), (6,ad_1.q6), (7,ad_1.q7), (8,ad_1.q8), (9,ad_1.q9), (10,ad_1.q10), (11,ad_1.q11), (12,ad_1.q12)) unp(num, answer)
                                    JOIN "biud-esg".questions q1 ON q1.tag::text = 'diagnosis'::text AND q1.number = unp.num) x
                        ORDER BY x.survey_id, x.question_id, x.prio DESC
                        )
                SELECT DISTINCT b_base.cnpj,
                    b_base.nome_empresa,
                    b_base.created_at,
                    b_base.uf,
                    b_base.contato,
                    b_base.cpf,
                    b_base.email,
                    b_base.phone AS telefone,
                    b_base.business_created_at AS criacao_empresa,
                    ad.updated_at AS auto_diagnostico,
                    ss.total_score AS score_atual,
                    ss.badge_level AS selo,
                    q.tag AS eixo,
                    q.text AS pergunta,
                    COALESCE(ans.resposta, 'não respondida'::text) AS resposta,
                    ss.passed_diagnosis,
                    ss.diagnosis_completed,
                    ss.env_completed,
                    ss.social_completed,
                    ss.gov_completed,
                    ss.general_status,
                    b_base.cpe_return AS porte,
                        CASE
                            WHEN b_base.size IS NOT NULL THEN b_base.size::text
                            ELSE COALESCE("substring"(b_base.cpe_return, '"porte"\s*:\s*(\d+)'::text), 'ni'::text)
                        END AS ds_porte,
                    dpe."SigPorte" AS porte_empresa,
                    qd.inicio_diagnostico,
                    qd.fim_diagnostico,
                    b_base.subscription_date
                FROM base b_base
                    LEFT JOIN survey_latest ss ON ss.company_id = b_base.company_id
                    LEFT JOIN "biud-esg".answer_diagnosis ad ON ad.survey_id = ss.id
                    LEFT JOIN best_answer ans ON ans.survey_id = ss.id
                    LEFT JOIN qd_agg qd ON qd.survey_id = ss.id
                    LEFT JOIN "biud-esg".questions q ON ans.question_id = q.id
                    LEFT JOIN dados_externos.dados_porte_empresa dpe ON
                        CASE
                            WHEN b_base.size IS NOT NULL THEN b_base.size::text
                            ELSE COALESCE("substring"(b_base.cpe_return, '"porte"\s*:\s*(\d+)'::text), 'ni'::text)
                        END = dpe.codigo::text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_batimento;`);
    }

}
