import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewRelatorioRepescagem1771507700000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_relatorio_repescagem
            AS WITH leads_pre_cadastro_e_login_amei AS (
                    SELECT vw_relatorio_usuarios_pre_cadastrados.cpf
                    FROM vw_relatorio_usuarios_pre_cadastrados
                UNION ALL
                    SELECT vw_relatorio_usuarios_cadastrados_amei.cpf
                    FROM vw_relatorio_usuarios_cadastrados_amei
                )
            SELECT ul.id,
                ul.nome,
                ul.cpf,
                ul.email,
                ul.telefone,
                ul.data_cadastro,
                ul.hora_cadastro,
                ul.url_cadastro,
                ul.utm_campaign,
                ul.utm_source,
                ul.utm_medium
            FROM leads_pre_cadastro_e_login_amei l
                LEFT JOIN vw_relatorio_licenca vrl ON l.cpf::text = vrl.cpf::text
                LEFT JOIN user_lead ul ON ul.cpf::text = l.cpf::text
            WHERE vrl.cpf IS NULL AND ul.cpf IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_relatorio_repescagem;`);
    }
}
