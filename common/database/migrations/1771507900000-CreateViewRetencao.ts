import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewRetencao1771507900000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_retencao
            AS WITH eixos_finalizados AS (
                    SELECT s.id AS survey_id,
                        max(
                            CASE
                                WHEN q.tag::text ~~* 'ENV%'::text THEN ao.created_at
                                ELSE NULL::timestamp with time zone
                            END) FILTER (WHERE s.env_completed) AS env_finished_at,
                        max(
                            CASE
                                WHEN q.tag::text ~~* 'SOC%'::text THEN ao.created_at
                                ELSE NULL::timestamp with time zone
                            END) FILTER (WHERE s.social_completed) AS social_finished_at,
                        max(
                            CASE
                                WHEN q.tag::text ~~* 'GOV%'::text THEN ao.created_at
                                ELSE NULL::timestamp with time zone
                            END) FILTER (WHERE s.gov_completed) AS gov_finished_at
                    FROM "biud-esg".surveys s
                        LEFT JOIN "biud-esg".answer_options ao ON ao.survey_id = s.id
                        LEFT JOIN "biud-esg".questions q ON q.id = ao.question_id
                    GROUP BY s.id
                ), audit_latest_per_step AS (
                    SELECT DISTINCT ON (sa.survey_id, sa."stepAudit") sa.survey_id,
                        sa."stepAudit" AS step_audit,
                        sa.badge_level,
                        sa.created_at,
                        sa.id
                    FROM "biud-esg".survey_audit sa
                    ORDER BY sa.survey_id, sa."stepAudit", sa.created_at DESC, sa.id DESC
                ), audit_latest_overall AS (
                    SELECT DISTINCT ON (sa.survey_id) sa.survey_id,
                        sa."stepAudit" AS step_audit,
                        sa.badge_level,
                        sa.created_at,
                        sa.id
                    FROM "biud-esg".survey_audit sa
                    WHERE sa."stepAudit" = (( SELECT max(x."stepAudit") AS max
                            FROM "biud-esg".survey_audit x
                            WHERE x.survey_id = sa.survey_id))
                    ORDER BY sa.survey_id, sa.created_at DESC, sa.id DESC
                ), audit_levels AS (
                    SELECT p.survey_id,
                        max(
                            CASE
                                WHEN p.step_audit = 1 THEN p.badge_level
                                ELSE NULL::character varying
                            END::text) AS nivel_primeira,
                        max(
                            CASE
                                WHEN p.step_audit = 2 THEN p.badge_level
                                ELSE NULL::character varying
                            END::text) AS nivel_segunda,
                        o.badge_level AS nivel_ultima,
                        max(
                            CASE
                                WHEN p.step_audit = 1 THEN p.created_at
                                ELSE NULL::timestamp without time zone
                            END) AS dt_primeira,
                        max(
                            CASE
                                WHEN p.step_audit = 2 THEN p.created_at
                                ELSE NULL::timestamp without time zone
                            END) AS dt_segunda,
                        o.created_at AS dt_ultima
                    FROM audit_latest_per_step p
                        LEFT JOIN audit_latest_overall o ON o.survey_id = p.survey_id
                    GROUP BY p.survey_id, o.badge_level, o.created_at
                ), eventos AS (
                    SELECT eh.user_id,
                        eh.cnpj,
                        max(eh.sent_at) AS last_sent_at
                    FROM "biud-esg".event_history eh
                    GROUP BY eh.user_id, eh.cnpj
                ), ao_last AS (
                    SELECT ao.survey_id,
                        max(ao.created_at) AS last_answer_at
                    FROM "biud-esg".answer_options ao
                    GROUP BY ao.survey_id
                ), sess AS (
                    SELECT s.username,
                        min(s.operation_timestamp) AS primeiro_login_amei,
                        max(s.operation_timestamp) AS ultimo_login_amei,
                        count(*) AS total_logins_acumulados
                    FROM vw_audit_tb_sessions_remota s
                    GROUP BY s.username
                ), audit_first AS (
                    SELECT DISTINCT ON (sa.survey_id) sa.survey_id,
                        sa.created_at AS primeiro_audit_created_at,
                            CASE
                                WHEN n.norm_badge = ANY (ARRAY['bronze'::text, 'prata'::text, 'ouro'::text, 'diamante'::text]) THEN sa.badge_level
                                WHEN n.norm_badge = 'tematico'::text THEN sa.badge_level
                                ELSE NULL::character varying
                            END AS primeiro_audit_badge_level
                    FROM "biud-esg".survey_audit sa
                        CROSS JOIN LATERAL ( SELECT translate(lower(COALESCE(sa.badge_level, ''::character varying)::text), 'áàâãäéèêëíìîïóòôõöúùûüç'::text, 'aaaaaeeeeiiiiooooouuuuc'::text) AS norm_badge) n
                    ORDER BY sa.survey_id, (
                            CASE
                                WHEN n.norm_badge = ANY (ARRAY['bronze'::text, 'prata'::text, 'ouro'::text, 'diamante'::text]) THEN 1
                                WHEN n.norm_badge = 'tematico'::text THEN 2
                                ELSE 3
                            END), sa.created_at, sa.id
                ), audit_last AS (
                    SELECT DISTINCT ON (sa.survey_id) sa.survey_id,
                        sa.created_at AS ultimo_audit_created_at,
                        sa.badge_level AS ultimo_audit_badge_level
                    FROM "biud-esg".survey_audit sa
                    ORDER BY sa.survey_id, sa.created_at DESC, sa.id DESC
                ), audit_step2 AS (
                    SELECT DISTINCT ON (sa.survey_id) sa.survey_id,
                        sa.created_at AS step2_audit_created_at,
                        sa.badge_level AS step2_audit_badge_level
                    FROM "biud-esg".survey_audit sa
                    WHERE sa."stepAudit" = 2
                    ORDER BY sa.survey_id, sa.created_at DESC, sa.id DESC
                ), first_cpfs AS (
                    SELECT DISTINCT u.cpf
                    FROM "user" u
                        LEFT JOIN business_user bu ON bu.user_id = u.id
                        LEFT JOIN business b ON b.id = bu.business_id
                        LEFT JOIN "biud-esg".companies c ON c.cnpj::text = b.cnpj::text
                        LEFT JOIN "biud-esg".surveys s1 ON s1.company_id = c.id
                        LEFT JOIN "biud-esg".licenses lic ON lic.company_id = c.id AND s1.created_at >= lic.created_at AND (lic.updated_at IS NULL OR s1.created_at < lic.updated_at)
                        LEFT JOIN dados_externos.dados_porte_empresa dpe ON
                            CASE
                                WHEN b.size IS NOT NULL THEN b.size::text
                                ELSE COALESCE(
                                CASE
                                    WHEN b.cpe_return IS NOT NULL AND b.cpe_return ~~ '%"porte"%'::text THEN "substring"(b.cpe_return, '"porte"[[:space:]]*:[[:space:]]*"?([^",}]+)"?'::text)
                                    ELSE NULL::text
                                END, 'NI'::text)
                            END = dpe.codigo::text
                    WHERE c.license_type = 'PLANNER'::"biud-esg".companies_license_type_enum AND (TRIM(BOTH FROM upper(dpe."SigPorte"::text)) = 'MEI'::text OR TRIM(BOTH FROM upper(COALESCE(dpe."SigPorte", 'NAO_MEI'::character varying)::text)) <> 'MEI'::text AND c.active_plan_name::text = 'Free-Sebrae'::text) AND u.email::text !~~* '%biud%'::text AND u.email::text !~~* '%valtech%'::text AND u.email::text !~~* '%sebrae%'::text AND u.type_login::text = 'amei'::text AND NOT (EXISTS ( SELECT 1
                            FROM users_testers ut
                            WHERE ut.cpf::text = u.cpf::text)) AND NOT (EXISTS ( SELECT 1
                            FROM users_testers utx
                            WHERE utx.cnpj::text = c.cnpj::text)) AND u.cpf IS NOT NULL
                )
            SELECT DISTINCT u.created_at AS data_cadastro_usuario,
                COALESCE(c.name, b.name, 'Sem empresa vinculada'::character varying) AS nome_empresa,
                COALESCE(b.cnpj, ''::character varying) AS cnpj,
                COALESCE(dpe."SigPorte", 'NI'::character varying) AS porte_empresa,
                COALESCE(b.cnae, 'Não informado'::character varying) AS cnae_empresa,
                COALESCE(c.uf, 'Não informado'::character varying) AS uf,
                COALESCE(lic.plan_name::text, c.license_type::text) AS license_type,
                COALESCE(lic.plan_name, c.active_plan_name)::character varying(100) AS active_plan_name,
                COALESCE(u.name, 'Não informado'::character varying) AS contato,
                COALESCE(u.cpf, ''::character varying) AS cpf,
                COALESCE(u.email, ''::character varying) AS email,
                COALESCE(u.phone, 'Não informado'::character varying) AS telefone,
                COALESCE(to_char((sess.primeiro_login_amei AT TIME ZONE 'America/Sao_Paulo'::text), 'YYYY-MM-DD HH24:MI:SS'::text), ''::text) AS primeiro_login_amei,
                COALESCE(to_char((sess.ultimo_login_amei AT TIME ZONE 'America/Sao_Paulo'::text), 'YYYY-MM-DD HH24:MI:SS'::text), ''::text) AS ultimo_login_amei,
                COALESCE(sess.total_logins_acumulados, 0::bigint)::integer AS total_logins_acumulados,
                bu.created_at::timestamp without time zone AS primeiro_vinculo_cnpj,
                s1.created_at AS primeiro_diagnostico_automatico,
                s1.created_at AS inicio_autodiagnostico,
                COALESCE(ad_last.fim_autodiagnostico, GREATEST(ef.env_finished_at, ef.social_finished_at, ef.gov_finished_at)::timestamp without time zone, ao_last.last_answer_at::timestamp without time zone) AS fim_autodiagnostico,
                NULL::timestamp without time zone AS primeiro_upload_evidencia,
                ef.env_finished_at::timestamp without time zone AS eixo_ambiental_finalizado,
                ef.social_finished_at::timestamp without time zone AS eixo_social_finalizado,
                ef.gov_finished_at::timestamp without time zone AS eixo_governanca_finalizado,
                NULL::timestamp without time zone AS primeira_confirmacao_eixos,
                NULL::timestamp without time zone AS segunda_confirmacao_eixos,
                NULL::timestamp without time zone AS ultima_confirmacao_eixos,
                COALESCE(af.primeiro_audit_badge_level::text, 'Sem primeira confirmação'::text) AS nivel_selo_primeira_confirmacao,
                af.primeiro_audit_created_at AS data_selo_primeira_confirmacao,
                COALESCE(a2.step2_audit_badge_level::text, 'Sem segunda confirmação'::text) AS nivel_selo_segunda_confirmacao,
                a2.step2_audit_created_at AS data_selo_segunda_confirmacao,
                COALESCE(alast.ultimo_audit_badge_level::text, 'Sem confirmação final'::text) AS nivel_selo_ultima_confirmacao,
                    CASE
                        WHEN COALESCE(alast.ultimo_audit_badge_level::text, 'Sem confirmação final'::text) = 'Sem confirmação final'::text THEN NULL::timestamp without time zone
                        ELSE alast.ultimo_audit_created_at
                    END AS data_selo_ultima_confirmacao
            FROM "user" u
                LEFT JOIN sess ON sess.username = u.email::text
                LEFT JOIN business_user bu ON bu.user_id = u.id
                LEFT JOIN business b ON b.id = bu.business_id
                LEFT JOIN "biud-esg".companies c ON c.cnpj::text = b.cnpj::text
                LEFT JOIN "biud-esg".surveys s1 ON s1.company_id = c.id
                LEFT JOIN "biud-esg".licenses lic ON lic.company_id = c.id AND s1.created_at >= lic.created_at AND (lic.updated_at IS NULL OR s1.created_at < lic.updated_at)
                LEFT JOIN dados_externos.dados_porte_empresa dpe ON
                    CASE
                        WHEN b.size IS NOT NULL THEN b.size::text
                        ELSE COALESCE(
                        CASE
                            WHEN b.cpe_return IS NOT NULL AND b.cpe_return ~~ '%"porte"%'::text THEN "substring"(b.cpe_return, '"porte"[[:space:]]*:[[:space:]]*"?([^",}]+)"?'::text)
                            ELSE NULL::text
                        END, 'NI'::text)
                    END = dpe.codigo::text
                LEFT JOIN ( SELECT qd_1.company_id,
                        min(qd_1.uploaded_at) AS uploaded_at
                    FROM "biud-esg".question_documents qd_1
                    GROUP BY qd_1.company_id) qd ON qd.company_id = c.id
                LEFT JOIN audit_levels al ON al.survey_id = s1.id
                LEFT JOIN eventos ev ON ev.user_id = u.id AND ev.cnpj::text = c.cnpj::text
                LEFT JOIN eixos_finalizados ef ON ef.survey_id = s1.id
                LEFT JOIN ao_last ON ao_last.survey_id = s1.id
                LEFT JOIN dados_externos.tb_users tbu ON u.email::text = tbu.username::text
                LEFT JOIN audit_first af ON af.survey_id = s1.id
                LEFT JOIN audit_step2 a2 ON a2.survey_id = s1.id
                LEFT JOIN audit_last alast ON alast.survey_id = s1.id
                LEFT JOIN LATERAL ( SELECT COALESCE(ad.updated_at, ad.created_at) AS fim_autodiagnostico
                    FROM "biud-esg".answer_diagnosis ad
                    WHERE ad.survey_id = s1.id AND COALESCE(ad.updated_at, ad.created_at) IS NOT NULL
                    ORDER BY (COALESCE(ad.updated_at, ad.created_at)) DESC
                    LIMIT 1) ad_last ON true
            WHERE c.license_type = 'PLANNER'::"biud-esg".companies_license_type_enum AND (TRIM(BOTH FROM upper(dpe."SigPorte"::text)) = 'MEI'::text OR TRIM(BOTH FROM upper(COALESCE(dpe."SigPorte", 'NAO_MEI'::character varying)::text)) <> 'MEI'::text AND c.active_plan_name::text = 'Free-Sebrae'::text) AND u.email::text !~~* '%biud%'::text AND u.email::text !~~* '%valtech%'::text AND u.email::text !~~* '%sebrae%'::text AND u.type_login::text = 'amei'::text AND NOT (EXISTS ( SELECT 1
                    FROM users_testers ut
                    WHERE ut.cpf::text = u.cpf::text)) AND NOT (EXISTS ( SELECT 1
                    FROM users_testers utx
                    WHERE utx.cnpj::text = c.cnpj::text))
            UNION ALL
            SELECT DISTINCT u.created_at AS data_cadastro_usuario,
                'Sem empresa vinculada'::character varying AS nome_empresa,
                ''::character varying AS cnpj,
                'NI'::character varying AS porte_empresa,
                'Não informado'::character varying AS cnae_empresa,
                'Não informado'::character varying AS uf,
                NULL::text AS license_type,
                NULL::character varying(100) AS active_plan_name,
                COALESCE(u.name, 'Não informado'::character varying) AS contato,
                COALESCE(u.cpf, ''::character varying) AS cpf,
                COALESCE(u.email, ''::character varying) AS email,
                COALESCE(u.phone, 'Não informado'::character varying) AS telefone,
                COALESCE(to_char((sess.primeiro_login_amei AT TIME ZONE 'America/Sao_Paulo'::text), 'YYYY-MM-DD HH24:MI:SS'::text), ''::text) AS primeiro_login_amei,
                COALESCE(to_char((sess.ultimo_login_amei AT TIME ZONE 'America/Sao_Paulo'::text), 'YYYY-MM-DD HH24:MI:SS'::text), ''::text) AS ultimo_login_amei,
                COALESCE(sess.total_logins_acumulados, 0::bigint)::integer AS total_logins_acumulados,
                NULL::timestamp without time zone AS primeiro_vinculo_cnpj,
                NULL::timestamp without time zone AS primeiro_diagnostico_automatico,
                NULL::timestamp without time zone AS inicio_autodiagnostico,
                NULL::timestamp without time zone AS fim_autodiagnostico,
                NULL::timestamp without time zone AS primeiro_upload_evidencia,
                NULL::timestamp without time zone AS eixo_ambiental_finalizado,
                NULL::timestamp without time zone AS eixo_social_finalizado,
                NULL::timestamp without time zone AS eixo_governanca_finalizado,
                NULL::timestamp without time zone AS primeira_confirmacao_eixos,
                NULL::timestamp without time zone AS segunda_confirmacao_eixos,
                NULL::timestamp without time zone AS ultima_confirmacao_eixos,
                'Não iniciado'::text AS nivel_selo_primeira_confirmacao,
                NULL::timestamp without time zone AS data_selo_primeira_confirmacao,
                'Sem segunda confirmação'::text AS nivel_selo_segunda_confirmacao,
                NULL::timestamp without time zone AS data_selo_segunda_confirmacao,
                'Sem confirmação final'::character varying AS nivel_selo_ultima_confirmacao,
                NULL::timestamp without time zone AS data_selo_ultima_confirmacao
            FROM "user" u
                LEFT JOIN sess ON sess.username = u.email::text
                LEFT JOIN user_lead l ON l.cpf::text = u.cpf::text
                LEFT JOIN users_testers ut ON u.cpf::text = ut.cpf::text
            WHERE ut.cpf IS NULL AND ut.cnpj IS NULL AND u.email::text !~~* '%biud%'::text AND u.email::text !~~* '%valtech%'::text AND u.email::text !~~* '%sebrae%'::text AND u.type_login::text = 'amei'::text AND ut.id IS NULL AND NOT (EXISTS ( SELECT 1
                    FROM users_testers ut2
                    WHERE ut2.cpf::text = u.cpf::text)) AND NOT (EXISTS ( SELECT 1
                    FROM first_cpfs f
                    WHERE f.cpf::text = u.cpf::text));
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_retencao;`);
    }
}
