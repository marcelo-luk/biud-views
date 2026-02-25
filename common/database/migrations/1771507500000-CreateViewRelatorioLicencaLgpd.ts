import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewRelatorioLicencaLgpd1771507500000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_relatorio_licenca_lgpd
            AS SELECT concat("left"(vw_relatorio_licenca.cpf::text, 4), '***', "right"(vw_relatorio_licenca.cpf::text, 4)) AS cpf,
                vw_relatorio_licenca.cnpj,
                vw_relatorio_licenca.name,
                vw_relatorio_licenca.cnae,
                vw_relatorio_licenca.created_at,
                vw_relatorio_licenca.uf,
                vw_relatorio_licenca.razao_social
            FROM vw_relatorio_licenca;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_relatorio_licenca_lgpd;`);
    }
}
