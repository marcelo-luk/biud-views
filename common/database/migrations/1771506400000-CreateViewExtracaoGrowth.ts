import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewExtracaoGrowth1771506400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_extracao_growth
            AS SELECT DISTINCT ON (c.cnpj) c.cnpj,
                c.created_at AS dt_cadastro,
                c.name AS nome_empresa,
                COALESCE(u.email, 'não informado'::character varying) AS email,
                    CASE
                        WHEN c.cnae IS NULL OR c.cnae = ' - '::text THEN 'não informado'::text
                        ELSE c.cnae
                    END AS cnae,
                c.uf,
                COALESCE(ul.url_cadastro, 'não informado'::text) AS url_cadastro_utm,
                COALESCE(ul.utm_campaign, 'não informado'::character varying) AS utm_campaign,
                    CASE
                        WHEN ul.utm_source IS NULL OR ul.utm_source::text = ''::text THEN 'não informado'::character varying
                        ELSE ul.utm_source
                    END AS utm_source,
                    CASE
                        WHEN ul.utm_medium IS NULL OR ul.utm_medium::text = ''::text THEN 'não informado'::character varying
                        ELSE ul.utm_medium
                    END AS utm_medium,
                l.subscription_date AS data_subscricao,
                c.active_plan_name AS plano,
                dpe."SigPorte" AS porte_empresa
            FROM "biud-esg".companies c
                LEFT JOIN "biud-esg".licenses l ON c.id = l.company_id
                LEFT JOIN "biud-esg".user_companies uc ON c.id = uc.company_id
                LEFT JOIN "biud-esg"."user" u ON uc.user_id = u.id
                LEFT JOIN "biud-esg".user_lead ul ON u.cpf::text = ul.cpf::text
                LEFT JOIN "biud-esg".users_testers ut ON ut.cpf::text = u.cpf::text
                LEFT JOIN "biud-esg".users_testers ut2 ON ut2.cnpj::text = c.cnpj::text
                LEFT JOIN dados_externos.dados_porte_empresa dpe ON
                    CASE
                        WHEN c.size IS NOT NULL THEN c.size::text
                        ELSE COALESCE("substring"(c.cpe_return, '"porte"\\s*:\\s*(\\d+)'::text), 'NI'::text)
                    END = dpe.codigo::text
            WHERE c.license_type = 'PLANNER'::"biud-esg".companies_license_type_enum
                AND (TRIM(BOTH FROM upper(dpe."SigPorte"::text)) = 'MEI'::text
                    OR TRIM(BOTH FROM upper(COALESCE(dpe."SigPorte", 'NAO_MEI'::character varying)::text)) <> 'MEI'::text
                        AND (c.active_plan_name::text = ANY (ARRAY['Free-Sebrae'::text, 'Sebrae-PAID'::text])))
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
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_extracao_growth;`);
    }
}
