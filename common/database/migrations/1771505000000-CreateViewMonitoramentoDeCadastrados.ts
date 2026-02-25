import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewMonitoramentoDeCadastrados1771505000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_monitoramento_de_cadastrados
            AS SELECT DISTINCT ON (c.cnpj) c.cnpj,
                c.name,
                c.created_at::timestamp without time zone AS created_at,
                c.uf,
                c.id,
                dpe."SigPorte",
                l.subscription_date,
                l.plan_name,
                u.email::text AS email
            FROM "biud-esg".companies c
                LEFT JOIN "biud-esg".user_companies uc ON c.id = uc.company_id
                LEFT JOIN "biud-esg"."user" u ON u.id = uc.user_id
                LEFT JOIN "biud-esg".licenses l ON l.company_id = c.id
                LEFT JOIN "biud-esg".users_testers ut ON ut.cpf::text = u.cpf::text
                LEFT JOIN "biud-esg".users_testers ut2 ON ut2.cnpj::text = c.cnpj::text
                LEFT JOIN dados_externos.dados_porte_empresa dpe ON
                    CASE
                        WHEN c.size IS NOT NULL THEN c.size::text
                        ELSE COALESCE("substring"(c.cpe_return, '"porte"\s*:\s*(\d+)'::text), 'NI'::text)
                    END = dpe.codigo::text
            WHERE c.license_type = 'PLANNER'::"biud-esg".companies_license_type_enum
                AND (
                    TRIM(BOTH FROM upper(dpe."SigPorte"::text)) = 'MEI'::text
                    OR (
                        TRIM(BOTH FROM upper(COALESCE(dpe."SigPorte", 'NAO_MEI'::character varying)::text)) <> 'MEI'::text
                        AND (c.active_plan_name::text = ANY (ARRAY['Free-Sebrae'::text, 'Sebrae-PAID'::text]))
                    )
                )
                AND ut.cpf IS NULL
                AND ut2.cnpj IS NULL
                AND u.email::text !~~* '%biud%'::text
                AND u.email::text !~~* '%valtech%'::text
                AND u.email::text !~~* '%sebrae%'::text
                AND u.type_login::text = 'amei'::text
                AND ut.id IS NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_monitoramento_de_cadastrados;`);
    }
}
