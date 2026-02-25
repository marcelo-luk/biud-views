import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewMapeamentoMpeSeloSintetico1771506900000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_mapeamento_mpe_selo_sintetico
            AS SELECT vw_evolucao_mpe_jornada.cnpj,
                vw_evolucao_mpe_jornada.uf,
                vw_evolucao_mpe_jornada.porte_empresa,
                vw_evolucao_mpe_jornada.subscription_date AS criacao_empresa,
                    CASE
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'Reconhecimento inicial'::text THEN 'Reconhecimento inicial'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'bronze'::text THEN 'Bronze'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'prata'::text THEN 'Prata'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'ouro'::text THEN 'Ouro'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'diamante'::text THEN 'Diamante'::text
                        WHEN TRIM(BOTH FROM vw_evolucao_mpe_jornada.aprovada_diagnostico) = 'Reprovada'::text THEN 'Reprovado auto diagnostico'::text
                        WHEN vw_evolucao_mpe_jornada.respondeu_diagnostico = 'Nao iniciado'::text THEN 'Não iniciou jornada'::text
                        WHEN vw_evolucao_mpe_jornada.respondeu_diagnostico = 'Incompleto'::text THEN 'Não iniciou jornada'::text
                        WHEN vw_evolucao_mpe_jornada.pesquisa_iniciada_em = 'Nao iniciada'::text THEN 'Não iniciou jornada'::text
                        ELSE NULL::text
                    END AS evolucao_esg,
                    CASE
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'Reconhecimento inicial'::text THEN 'tematico'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'bronze'::text THEN 'bronze'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'prata'::text THEN 'prata'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'ouro'::text THEN 'ouro'::text
                        WHEN vw_evolucao_mpe_jornada.nivel_selo::text = 'diamante'::text THEN 'diamante'::text
                        ELSE NULL::text
                    END AS selo,
                now() AS dt_atualizacao
            FROM vw_evolucao_mpe_jornada;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_mapeamento_mpe_selo_sintetico;`);
    }
}
