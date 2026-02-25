import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewRelatorioLicenca1771507400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_relatorio_licenca
            AS WITH user_company_details AS (
                SELECT DISTINCT b.cnpj,
                    b.name::character varying(250) AS razao_social,
                    u.name,
                    u.cpf,
                    u.phone,
                    u.email,
                    b.cnae::character varying(500) AS cnae,
                    b.cpe_return AS porte,
                        CASE
                            WHEN b.size IS NOT NULL THEN b.size::text
                            ELSE COALESCE("substring"(b.cpe_return, '"porte"\s*:\s*(\d+)'::text), 'ni'::text)
                        END AS ds_porte
                FROM "biud-esg"."user" u
                    JOIN "biud-esg".user_companies uc ON uc.user_id = u.id
                    JOIN "biud-esg".companies b ON b.id = uc.company_id
                    LEFT JOIN "biud-esg".users_testers ut ON ut.cnpj::text = b.cnpj::text
                        OR u.cpf::text = ut.cpf::text
                WHERE u.type_login::text = 'amei'::text
                    AND ut.id IS NULL
            )
            SELECT DISTINCT ON (vw.cnpj) ucd.cpf,
                vw.cnpj,
                ucd.name,
                ucd.cnae,
                vw.created_at,
                vw.uf,
                ucd.porte,
                ucd.ds_porte,
                ucd.razao_social,
                s.id AS surveys_id,
                l.subscription_date,
                c.active_plan_name::character varying AS plan_name,
                c.license_type
            FROM vw_monitoramento_de_cadastrados vw
                LEFT JOIN user_company_details ucd ON ucd.cnpj::text = vw.cnpj::text
                LEFT JOIN "biud-esg".companies c ON vw.cnpj::text = c.cnpj::text
                LEFT JOIN "biud-esg".surveys s ON c.id = s.company_id
                LEFT JOIN "biud-esg".licenses l ON c.id = l.company_id
            WHERE ucd.cpf IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_relatorio_licenca;`);
    }
}
