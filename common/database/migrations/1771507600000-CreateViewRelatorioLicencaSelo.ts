import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewRelatorioLicencaSelo1771507600000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_relatorio_licenca_selo
            AS SELECT l.cpf,
                l.cnpj,
                l.name,
                l.cnae,
                l.created_at,
                l.uf,
                l.porte,
                    CASE
                        WHEN s.badge_level::text = 'tematico'::text THEN 'Reconhecimento inicial'::character varying
                        WHEN s.badge_level IS NULL THEN 'Não atingiu pontuação minima'::character varying
                        ELSE s.badge_level
                    END AS nivel_selo,
                s.created_at AS survey_created_at,
                s.diagnosis_completed AS respondeu_diagnostico,
                s.passed_diagnosis AS aprovada_diagnostico,
                s.env_completed AS eixo_ambiental_completo,
                s.social_completed AS eixo_social_completo,
                s.gov_completed AS eixo_governanca_completo,
                s.step AS tentativas,
                s.total_score AS pontuacao_total,
                s.badge_level AS selo,
                s.name AS survey_name,
                s.general_status AS survey_general_status,
                s.id AS survey_id
            FROM vw_relatorio_licenca l
                LEFT JOIN "biud-esg".companies c ON c.cnpj::text = l.cnpj::text
                LEFT JOIN "biud-esg".surveys s ON c.id = s.company_id;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_relatorio_licenca_selo;`);
    }
}
