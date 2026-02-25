import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewEmpresasPorCpf1771506000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_empresas_por_cpf
            AS WITH relatorio_agrupado AS (
                    SELECT relatorio.cpf,
                        count(relatorio.cnpj) AS total_empresas
                    FROM relatorio
                    GROUP BY relatorio.cpf
                )
            SELECT ra.cpf,
                ra.total_empresas
            FROM relatorio_agrupado ra;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_empresas_por_cpf;`);
    }
}
