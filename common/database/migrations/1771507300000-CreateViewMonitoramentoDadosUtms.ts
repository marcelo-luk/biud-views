import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewMonitoramentoDadosUtms1771507300000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_monitoramento_dados_utms
            AS SELECT DISTINCT ON (c.cnpj) c.cnpj,
                c.name,
                c.created_at::timestamp without time zone AS created_at,
                c.uf,
                c.id,
                lu.utm_campaign,
                lu.utm_source,
                lu.utm_medium,
                l.subscription_date
            FROM "biud-esg".companies c
                JOIN business b ON b.cnpj::text = c.cnpj::text
                JOIN business_user bu ON bu.business_id = b.id
                JOIN "user" u ON u.id = bu.user_id
                JOIN "biud-esg".licenses l ON l.company_id = c.id
                LEFT JOIN users_testers ut ON ut.cpf::text = u.cpf::text
                LEFT JOIN users_testers ut2 ON ut2.cnpj::text = c.cnpj::text
                LEFT JOIN user_lead_company ul ON ul.cnpj::text = c.cnpj::text
                LEFT JOIN user_lead lu ON ul.user_lead_id = lu.id
            WHERE c.license_type = 'PLANNER'::"biud-esg".companies_license_type_enum
                AND c.active_plan_name::text = 'Free-Sebrae'::text
                AND ut.cpf IS NULL
                AND ut2.cnpj IS NULL
                AND u.email::text !~~* '%biud%'::text
                AND u.email::text !~~* '%valtech%'::text
                AND u.email::text !~~* '%sebrae%'::text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_monitoramento_dados_utms;`);
    }
}
