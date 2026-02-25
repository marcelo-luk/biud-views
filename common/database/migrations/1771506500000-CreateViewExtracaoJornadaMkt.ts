import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewExtracaoJornadaMkt1771506500000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE VIEW public.vw_extracao_jornada_mkt
            AS WITH ranked_data AS (
                SELECT c.cnpj,
                    COALESCE(pi.cpf, u.cpf) AS cpf,
                    COALESCE(pi.name, u.name) AS nome,
                    c.name AS empresa,
                    ins.started_at AS preenchimento_jornada_mkt,
                    c.cnae,
                    c.created_at AS data_criacao_empresa,
                    COALESCE(pi.phone, u.phone) AS telefone,
                    ins.status AS preenchimento_autodiagnostico,
                    COALESCE(wi.is_active, false) AS integrou_whatsapp,
                    wi.created_at AS data_integracao,
                    u.created_at AS data_cadastro_amei,
                    CASE
                        WHEN chs.total_message_count > 0 THEN true
                        ELSE false
                    END AS enviou_mensagens,
                    c.license_type AS nome_plano,
                    c.active_plan_name AS plano,
                    COALESCE(si.send_nf_enabled, false) AS integrou_emissor_nf,
                    CASE
                        WHEN nfed.id IS NOT NULL THEN true
                        ELSE false
                    END AS subiu_planilha
                FROM "biud-esg".insight_submission ins
                    LEFT JOIN "biud-esg".companies c ON c.id = ins.company_id
                    LEFT JOIN "biud-esg".person_info pi ON pi.company_id = ins.company_id
                    LEFT JOIN business b ON b.cnpj::text = c.cnpj::text
                    LEFT JOIN business_user bu ON bu.business_id = b.id
                    LEFT JOIN "user" u ON u.id = bu.user_id
                    LEFT JOIN "biud-esg".whatsapp_instances wi ON wi.enterprise_id = ins.company_id
                    LEFT JOIN "biud-esg".conversation_history_snapshot chs ON chs.company_id::integer = ins.company_id
                    LEFT JOIN "biud-esg".sebrae_installs si ON si.cnpj::text = c.cnpj::text
                    LEFT JOIN "biud-esg".nfe_data nfed ON nfed.cnpj::text = c.cnpj::text
                WHERE c.license_type <> 'TESTER'::"biud-esg".companies_license_type_enum
            )
            SELECT ranked_data.cnpj,
                ranked_data.cpf,
                ranked_data.nome,
                ranked_data.empresa,
                ranked_data.preenchimento_jornada_mkt,
                ranked_data.cnae,
                ranked_data.data_criacao_empresa,
                ranked_data.telefone,
                ranked_data.preenchimento_autodiagnostico,
                ranked_data.integrou_whatsapp,
                ranked_data.data_integracao,
                ranked_data.data_cadastro_amei,
                ranked_data.enviou_mensagens,
                ranked_data.integrou_emissor_nf,
                ranked_data.subiu_planilha,
                ranked_data.nome_plano,
                ranked_data.plano
            FROM ranked_data
            GROUP BY ranked_data.cnpj, ranked_data.cpf, ranked_data.nome, ranked_data.empresa, ranked_data.preenchimento_jornada_mkt, ranked_data.cnae, ranked_data.data_criacao_empresa, ranked_data.telefone, ranked_data.preenchimento_autodiagnostico, ranked_data.integrou_whatsapp, ranked_data.data_integracao, ranked_data.data_cadastro_amei, ranked_data.enviou_mensagens, ranked_data.integrou_emissor_nf, ranked_data.subiu_planilha, ranked_data.nome_plano, ranked_data.plano
            ORDER BY ranked_data.preenchimento_jornada_mkt;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_extracao_jornada_mkt;`);
    }
}
