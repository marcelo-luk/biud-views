import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewDetalhamentoMrr1771505900000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_detalhamento_mrr
            AS WITH base_query AS (
                    SELECT DISTINCT ON (c.cnpj) c.cnpj,
                        c.name AS nome_empresa,
                        dpe."SigPorte" AS porte,
                        c.active_plan_name::text AS active_plan_name,
                        c.license_type,
                        l.subscription_date,
                        l.churn_at AS expiration_date,
                            CASE
                                WHEN c.license_type = 'CHURN'::"biud-esg".companies_license_type_enum THEN l.expiration_date
                                ELSE NULL::timestamp without time zone
                            END AS churn_date
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
                    WHERE ut.cpf IS NULL
                        AND ut2.cnpj IS NULL
                        AND (c.license_type = ANY (ARRAY['PLANNER'::"biud-esg".companies_license_type_enum, 'CHURN'::"biud-esg".companies_license_type_enum]))
                        AND u.email::text !~~* '%biud%'::text
                        AND u.email::text !~~* '%valtech%'::text
                        AND u.email::text !~~* '%sebrae%'::text
                        AND u.type_login::text = 'amei'::text
                        AND ut.id IS NULL
                        AND l.subscription_date IS NOT NULL
                        AND (
                            (dpe."SigPorte"::text = ANY (ARRAY['ME'::character varying::text, 'EPP'::character varying::text, 'MEI'::character varying::text]))
                            OR dpe."SigPorte"::text = 'Demais'::text
                            AND c.license_type = 'CHURN'::"biud-esg".companies_license_type_enum
                        )
                    ), meses_gerados AS (
                    SELECT bq.cnpj,
                        bq.nome_empresa,
                        bq.porte,
                        bq.active_plan_name,
                        bq.license_type,
                        bq.subscription_date,
                        bq.expiration_date,
                        bq.churn_date,
                        date_trunc('month'::text, mes_ref.mes)::date AS mes_referencia
                    FROM base_query bq
                        CROSS JOIN LATERAL generate_series(
                            date_trunc('month'::text, bq.subscription_date)::timestamp with time zone,
                            date_trunc('month'::text, CURRENT_DATE::timestamp with time zone),
                            '1 mon'::interval
                        ) mes_ref(mes)
                    )
            SELECT meses_gerados.cnpj,
                meses_gerados.nome_empresa,
                meses_gerados.porte,
                meses_gerados.active_plan_name,
                meses_gerados.license_type,
                meses_gerados.subscription_date,
                meses_gerados.expiration_date,
                meses_gerados.churn_date,
                EXTRACT(year FROM meses_gerados.mes_referencia)::integer AS ano_referencia,
                EXTRACT(month FROM meses_gerados.mes_referencia)::integer AS mes_ref,
                    CASE
                        WHEN (meses_gerados.active_plan_name = ANY (ARRAY['Free-Sebrae'::text, 'Sebrae-PAID'::text]))
                            AND (
                                meses_gerados.license_type = 'PLANNER'::"biud-esg".companies_license_type_enum
                                OR meses_gerados.license_type = 'CHURN'::"biud-esg".companies_license_type_enum
                                AND meses_gerados.mes_referencia <= date_trunc('month'::text, meses_gerados.expiration_date)
                            )
                        THEN 69.90
                        ELSE 0::numeric
                    END AS vl_mrr,
                    CASE
                        WHEN meses_gerados.license_type = 'CHURN'::"biud-esg".companies_license_type_enum
                            AND meses_gerados.expiration_date IS NOT NULL
                            AND meses_gerados.mes_referencia = (date_trunc('month'::text, meses_gerados.expiration_date) + '1 mon'::interval)
                        THEN '-69.90'::numeric
                        ELSE 0::numeric
                    END AS vl_churn
            FROM meses_gerados
            ORDER BY meses_gerados.cnpj, meses_gerados.mes_referencia;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_detalhamento_mrr;`);
    }
}
