import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewValidacaoMiaEManual1771508000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_validacao_mia_e_manual
            AS WITH qso_unique AS (
                    SELECT DISTINCT ON (qso.question_id, qso.option) qso.question_id,
                        qso.option,
                        qso.label AS ds_item
                    FROM "biud-esg".question_select_options qso
                    ORDER BY qso.question_id, qso.option, qso.id DESC
                ), combos AS (
                    SELECT DISTINCT c.cnpj,
                        c.name AS company_name,
                        c.uf,
                        u.number,
                        u.tag,
                        qd.option,
                        s.badge_level,
                        s.general_status,
                        u.text AS ds_pergunta,
                        qso.ds_item
                    FROM "biud-esg".question_documents qd
                        JOIN "biud-esg".companies c ON c.id = qd.company_id
                        JOIN "biud-esg".questions u ON u.id = qd.question_id
                        LEFT JOIN qso_unique qso ON qso.question_id = u.id AND qso.option::text = qd.option::text
                        LEFT JOIN "biud-esg".surveys s ON s.company_id = c.id
                        LEFT JOIN users_testers ut ON ut.cnpj::text = c.cnpj::text
                    WHERE ut.id IS NULL
                )
            SELECT cb.cnpj,
                cb.company_name,
                cb.uf,
                cb.badge_level,
                cb.general_status,
                cb.number,
                cb.tag,
                cb.option,
                replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(cb.ds_pergunta::text, '</strong>'::text, ''::text), '<strong>'::text, ''::text), '</STRONG>'::text, ''::text), '<STRONG>'::text, ''::text), '</stgrong>'::text, ''::text), '<stgrong>'::text, ''::text), '</STGRONG>'::text, ''::text), '<STGRONG>'::text, ''::text), '&lt;/strong&gt;'::text, ''::text), '&lt;strong&gt;'::text, ''::text), '&lt;/STGRONG&gt;'::text, ''::text), '&lt;STGRONG&gt;'::text, ''::text), '&amp;lt;/strong&amp;gt;'::text, ''::text), '&amp;lt;strong&amp;gt;'::text, ''::text), '&amp;lt;/stgrong&amp;gt;'::text, ''::text), '&amp;lt;stgrong&amp;gt;'::text, ''::text)::character varying AS ds_pergunta,
                replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(cb.ds_item, '</strong>'::text, ''::text), '<strong>'::text, ''::text), '</STRONG>'::text, ''::text), '<STRONG>'::text, ''::text), '</stgrong>'::text, ''::text), '<stgrong>'::text, ''::text), '</STGRONG>'::text, ''::text), '<STGRONG>'::text, ''::text), '&lt;/strong&gt;'::text, ''::text), '&lt;strong&gt;'::text, ''::text), '&lt;/STGRONG&gt;'::text, ''::text), '&lt;STGRONG&gt;'::text, ''::text), '&amp;lt;/strong&amp;gt;'::text, ''::text), '&amp;lt;strong&amp;gt;'::text, ''::text), '&amp;lt;/stgrong&amp;gt;'::text, ''::text), '&amp;lt;stgrong&amp;gt;'::text, ''::text) AS ds_item,
                    CASE
                        WHEN mia.validated_val IS TRUE THEN 'Aprovado'::text
                        WHEN mia.validated_val IS FALSE THEN 'Reprovado'::text
                        ELSE NULL::text
                    END AS status_mia,
                mia.validated_at_val AS last_mia_validation_at,
                mia.justification_val AS justification_mia,
                    CASE
                        WHEN man.validated_val IS TRUE THEN 'Aprovado'::text
                        WHEN man.validated_val IS FALSE THEN 'Reprovado'::text
                        ELSE NULL::text
                    END AS status_manual,
                man.validated_at_val AS last_manual_validation_at,
                man.validated_by_val AS validated_by_manual,
                regexp_replace(man.justification_val, '-->\\s*\\[\\s*DOUBLECHECK\\s+MIA\\s*\\]\\s*<--\\s*'::text, ''::text, 'gi'::text) AS justification_manual
            FROM combos cb
                LEFT JOIN LATERAL ( SELECT e.validated_val,
                        e.validated_at_val,
                        e.justification_val
                    FROM ( SELECT qa.validated AS validated_val,
                            qa.validated_at AS validated_at_val,
                            qa.justification AS justification_val
                        FROM "biud-esg".question_document_audit qa
                            JOIN "biud-esg".question_documents qd ON qd.id = qa.document_id
                            JOIN "biud-esg".companies c ON c.id = qd.company_id
                            JOIN "biud-esg".questions u ON u.id = qd.question_id
                        WHERE c.cnpj::text = cb.cnpj::text AND u.number = cb.number AND u.tag::text = cb.tag::text AND qd.option = cb.option AND qa.validated_by::text = 'MIA'::text
                    UNION ALL
                        SELECT qd.validated AS validated_val,
                            qd.validated_at AS validated_at_val,
                            NULL::text AS justification_val
                        FROM "biud-esg".question_documents qd
                            JOIN "biud-esg".companies c ON c.id = qd.company_id
                            JOIN "biud-esg".questions u ON u.id = qd.question_id
                        WHERE c.cnpj::text = cb.cnpj::text AND u.number = cb.number AND u.tag::text = cb.tag::text AND qd.option = cb.option AND qd.validated_by::text = 'MIA'::text) e
                    ORDER BY (e.validated_val IS NULL), e.validated_at_val DESC NULLS LAST
                    LIMIT 1) mia ON true
                JOIN LATERAL ( SELECT e.validated_val,
                        e.validated_at_val,
                        e.validated_by_val,
                        e.justification_val
                    FROM ( SELECT qa.validated AS validated_val,
                            qa.validated_at AS validated_at_val,
                            qa.validated_by AS validated_by_val,
                            qa.justification AS justification_val
                        FROM "biud-esg".question_document_audit qa
                            JOIN "biud-esg".question_documents qd ON qd.id = qa.document_id
                            JOIN "biud-esg".companies c ON c.id = qd.company_id
                            JOIN "biud-esg".questions u ON u.id = qd.question_id
                        WHERE c.cnpj::text = cb.cnpj::text AND u.number = cb.number AND u.tag::text = cb.tag::text AND qd.option = cb.option AND qa.validated_by::text <> 'MIA'::text AND qa.validated IS NOT NULL
                    UNION ALL
                        SELECT qd.validated AS validated_val,
                            qd.validated_at AS validated_at_val,
                            qd.validated_by AS validated_by_val,
                            NULL::text AS justification_val
                        FROM "biud-esg".question_documents qd
                            JOIN "biud-esg".companies c ON c.id = qd.company_id
                            JOIN "biud-esg".questions u ON u.id = qd.question_id
                        WHERE c.cnpj::text = cb.cnpj::text AND u.number = cb.number AND u.tag::text = cb.tag::text AND qd.option = cb.option AND qd.validated_by IS NOT NULL AND qd.validated_by::text <> 'MIA'::text AND qd.validated IS NOT NULL) e
                    ORDER BY e.validated_at_val DESC NULLS LAST
                    LIMIT 1) man ON true
            ORDER BY cb.cnpj, cb.tag, cb.number, cb.option;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_validacao_mia_e_manual;`);
    }
}
