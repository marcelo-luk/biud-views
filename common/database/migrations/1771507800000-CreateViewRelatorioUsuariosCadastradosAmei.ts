import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewRelatorioUsuariosCadastradosAmei1771507800000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_relatorio_usuarios_cadastrados_amei
            AS SELECT DISTINCT ON (u.cpf) u.cpf,
                u.name,
                u.email,
                u.phone,
                u.created_at::timestamp(0) without time zone AS created_at,
                l.url_cadastro,
                l.utm_campaign,
                l.utm_medium,
                l.data_cadastro AS lead_data_cadastro,
                l.hora_cadastro AS lead_hora_cadastro,
                c.uf,
                dpe."SigPorte" AS porte_empresa,
                c.cnae,
                l.utm_source
            FROM "biud-esg"."user" u
                LEFT JOIN "biud-esg".user_lead l ON l.cpf::text = u.cpf::text
                LEFT JOIN "biud-esg".users_testers ut ON u.cpf::text = ut.cpf::text
                LEFT JOIN "biud-esg".user_companies uc ON u.id = uc.user_id
                LEFT JOIN "biud-esg".companies c ON uc.company_id = c.id
                LEFT JOIN dados_externos.dados_porte_empresa dpe ON
                    CASE
                        WHEN c.size IS NOT NULL THEN c.size::text
                        ELSE COALESCE("substring"(c.cpe_return, '"porte"\\s*:\\s*(\\d+)'::text), 'NI'::text)
                    END = dpe.codigo::text
            WHERE ut.id IS NULL
                AND u.type_login::text = 'amei'::text
                AND u.cpf IS NOT NULL
                AND u.email::text !~~* '%valtech%'::text
                AND u.email::text !~~* '%sebrae%'::text
                AND u.email::text !~~* '%biud%'::text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_relatorio_usuarios_cadastrados_amei;`);
    }
}
