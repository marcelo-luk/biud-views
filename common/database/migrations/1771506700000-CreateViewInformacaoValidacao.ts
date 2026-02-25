import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewInformacaoValidacao1771506700000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_informacao_validacao
            AS WITH validations AS (
                    SELECT c.name AS company_name,
                        c.cnpj,
                        c.uf,
                        a.document_id,
                        a.validated_by,
                        a.validated,
                        regexp_replace(a.justification, '-->\[ DOUBLECHECK MIA \]<--\s*'::text, ''::text, 'g'::text) AS justification,
                        a.validated_at
                    FROM "biud-esg".question_document_audit a
                        LEFT JOIN "biud-esg".question_documents q ON a.document_id = q.id
                        LEFT JOIN "biud-esg".companies c ON q.company_id = c.id
                ), agg_validations AS (
                    SELECT v.company_name,
                        v.cnpj,
                        v.uf,
                        v.document_id,
                            CASE
                                WHEN max(
                                CASE
                                    WHEN v.validated_by::text = 'MIA'::text AND v.validated = true THEN 1
                                    ELSE 0
                                END) = 1 THEN 'Aprovado'::text
                                WHEN max(
                                CASE
                                    WHEN v.validated_by::text = 'MIA'::text AND v.validated = false THEN 1
                                    ELSE 0
                                END) = 1 THEN 'Reprovado'::text
                                ELSE NULL::text
                            END AS status_mia,
                            CASE
                                WHEN max(
                                CASE
                                    WHEN v.validated_by::text <> 'MIA'::text AND v.validated = true THEN 1
                                    ELSE 0
                                END) = 1 THEN 'Aprovado'::text
                                WHEN max(
                                CASE
                                    WHEN v.validated_by::text <> 'MIA'::text AND v.validated = false THEN 1
                                    ELSE 0
                                END) = 1 THEN 'Reprovado'::text
                                ELSE NULL::text
                            END AS status_manual,
                        string_agg(DISTINCT v.justification, ' || '::text) FILTER (WHERE v.validated_by::text = 'MIA'::text) AS justification_mia,
                        string_agg(DISTINCT v.justification, ' || '::text) FILTER (WHERE v.validated_by::text <> 'MIA'::text) AS justification_manual,
                        max(v.validated_at) FILTER (WHERE v.validated_by::text = 'MIA'::text) AS last_mia_validation_at,
                        max(v.validated_at) FILTER (WHERE v.validated_by::text <> 'MIA'::text) AS last_manual_validation_at,
                        v.validated_by
                    FROM validations v
                    GROUP BY v.company_name, v.cnpj, v.uf, v.document_id, v.validated_by
                )
            SELECT agg_validations.company_name,
                agg_validations.cnpj,
                agg_validations.uf,
                agg_validations.document_id,
                agg_validations.status_mia,
                agg_validations.last_mia_validation_at,
                agg_validations.justification_mia,
                agg_validations.status_manual,
                agg_validations.last_manual_validation_at,
                agg_validations.justification_manual,
                agg_validations.validated_by
            FROM agg_validations
            ORDER BY agg_validations.cnpj, agg_validations.document_id;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_informacao_validacao;`);
    }
}
