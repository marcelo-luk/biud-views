import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewEvolucaoMpeJornadaRecommendations1771506200000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_evolucao_mpe_jornada_recommendations
            AS WITH rankeddata AS (
                    SELECT l.cpf,
                        u.name AS nome_do_usuario,
                        u.phone::text AS telefone_do_usuario,
                        u.email AS email_do_usuario,
                        l.cnpj::text AS cnpj,
                        l.razao_social,
                            CASE
                                WHEN l.cnae IS NULL OR l.cnae::text = ''::text THEN 'Não informado'::text
                                ELSE replace(replace(l.cnae::text, chr(10), ' '::text), chr(13), ' '::text)
                            END AS cnae,
                        l.created_at AS empresa_cadastrada_em,
                        l.uf,
                        l.porte_empresa,
                        COALESCE(survey_data.created_at::text, 'Nao iniciada'::text) AS pesquisa_iniciada_em,
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
                                WHEN survey_data.env_completed IS TRUE
                                    OR (survey_data.badge_level::text = ANY (ARRAY['bronze'::text, 'prata'::text, 'ouro'::text, 'diamante'::text]))
                                THEN 'Aprovada'::text
                                ELSE 'Nao iniciada'::text
                            END AS eixo_ambiental_completo,
                            CASE
                                WHEN survey_data.social_completed IS TRUE
                                    OR (survey_data.badge_level::text = ANY (ARRAY['bronze'::text, 'prata'::text, 'ouro'::text, 'diamante'::text]))
                                THEN 'Aprovada'::text
                                ELSE 'Nao iniciada'::text
                            END AS eixo_social_completo,
                            CASE
                                WHEN survey_data.gov_completed IS TRUE
                                    OR (survey_data.badge_level::text = ANY (ARRAY['bronze'::text, 'prata'::text, 'ouro'::text, 'diamante'::text]))
                                THEN 'Aprovada'::text
                                ELSE 'Nao iniciada'::text
                            END AS eixo_governanca_completo,
                        COALESCE(survey_data.step, 0) AS tentativas,
                        COALESCE(survey_data.total_score, 0) AS pontuacao_total,
                            CASE
                                WHEN survey_data.badge_level::text = ANY (ARRAY['Reconhecimento Inicial'::text, 'tematico'::text]) THEN 'Reconhecimento inicial'::character varying
                                WHEN survey_data.badge_level IS NULL THEN 'Sem selo'::character varying
                                ELSE survey_data.badge_level
                            END AS nivel_selo,
                        survey_data.evento,
                        survey_data.topico,
                        survey_data.codigos_solucoes,
                        survey_data.nomes_solucoes,
                        survey_data.protocolos_sebrae,
                        row_number() OVER (PARTITION BY l.cnpj ORDER BY l.created_at DESC, survey_data.created_at DESC NULLS LAST) AS rn
                    FROM dados_externos.vw_mapeamento_licenca_porte_mpe l
                        LEFT JOIN "user" u ON u.cpf::text = l.cpf_original::text
                        LEFT JOIN (
                            SELECT s.company_id,
                                s.step,
                                s.passed_diagnosis,
                                s.created_at,
                                s.total_score,
                                s.badge_level,
                                s.env_completed,
                                s.social_completed,
                                s.gov_completed,
                                s.diagnosis_completed,
                                c.cnpj,
                                string_agg(DISTINCT sl.log_type::text, ', '::text) AS evento,
                                string_agg(DISTINCT sl.topic::text, ', '::text) AS topico,
                                string_agg(DISTINCT sl.solution_code::text, ', '::text) AS codigos_solucoes,
                                string_agg(DISTINCT sl.solution_name, ', '::text) AS nomes_solucoes,
                                string_agg(DISTINCT sl.sebrae_protocol::text, ', '::text) AS protocolos_sebrae
                            FROM "biud-esg".companies c
                                LEFT JOIN "biud-esg".surveys s ON c.id = s.company_id
                                LEFT JOIN "biud-esg".solution_logs sl ON sl.company_id = s.company_id
                            GROUP BY s.company_id, s.step, s.passed_diagnosis, s.created_at, s.total_score, s.badge_level, s.env_completed, s.social_completed, s.gov_completed, s.diagnosis_completed, c.cnpj
                        ) survey_data ON survey_data.cnpj::text = l.cnpj::text
                    WHERE l.plan_name::text = 'Free-Sebrae'::text
                        AND (l.porte_empresa::text = ANY (ARRAY['ME'::text, 'EPP'::text, 'MEI'::text]))
                )
            SELECT rankeddata.cpf,
                rankeddata.nome_do_usuario,
                rankeddata.telefone_do_usuario,
                rankeddata.email_do_usuario,
                rankeddata.cnpj,
                rankeddata.razao_social,
                rankeddata.cnae,
                rankeddata.empresa_cadastrada_em,
                rankeddata.uf,
                rankeddata.porte_empresa,
                rankeddata.pesquisa_iniciada_em,
                rankeddata.respondeu_diagnostico,
                rankeddata.aprovada_diagnostico,
                rankeddata.eixo_ambiental_completo,
                rankeddata.eixo_social_completo,
                rankeddata.eixo_governanca_completo,
                rankeddata.tentativas,
                rankeddata.pontuacao_total,
                rankeddata.nivel_selo,
                rankeddata.evento,
                rankeddata.topico,
                rankeddata.codigos_solucoes,
                rankeddata.nomes_solucoes,
                rankeddata.protocolos_sebrae,
                rankeddata.rn
            FROM rankeddata
            WHERE rankeddata.rn = 1;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_evolucao_mpe_jornada_recommendations;`);
    }
}
