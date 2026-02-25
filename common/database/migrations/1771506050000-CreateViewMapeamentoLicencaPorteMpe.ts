import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewMapeamentoLicencaPorteMpe1771506050000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW dados_externos.vw_mapeamento_licenca_porte_mpe
            AS SELECT concat("left"(a.cpf::text, 4), '***', "right"(a.cpf::text, 4)) AS cpf,
                a.cnpj,
                a.name,
                a.cnae,
                a.created_at,
                a.uf,
                dpe."SigPorte" AS porte_empresa,
                a.razao_social,
                ul.utm_campaign,
                ul.utm_source,
                ul.utm_medium,
                a.cpf AS cpf_original,
                a.subscription_date,
                a.plan_name,
                a.license_type
            FROM vw_relatorio_licenca a
                LEFT JOIN dados_externos.dados_porte_empresa dpe ON a.ds_porte = dpe.codigo::text
                LEFT JOIN user_lead ul ON a.cpf::text = ul.cpf::text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS dados_externos.vw_mapeamento_licenca_porte_mpe;`);
    }
}
