import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateViewAuditTbSessions1771504849025 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_audit_tb_sessions_remota;`);
        await queryRunner.query(`
            CREATE VIEW public.vw_audit_tb_sessions_remota
            AS SELECT (t.operation_timestamp AT TIME ZONE 'America/Sao_Paulo'::text) AS operation_timestamp,
                t.username,
                t.operation_type,
                t.old_value,
                t.new_value,
                t.operator_username
            FROM dblink.dblink('host=34.42.72.88 port=5432 dbname=biud_authentication user=consultor_biud password=84dqcBjkbqKsLz options=''-c search_path=dados_externos -c TimeZone=America/Sao_Paulo'''::text, 'SELECT
                    operation_timestamp,
                    username,
                    operation_type,
                    old_value::text,
                    new_value::text,
                    operator_username
                FROM public.audit_tb_sessions'::text) t(operation_timestamp timestamp with time zone, username text, operation_type text, old_value text, new_value text, operator_username text);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS public.vw_audit_tb_sessions_remota;`);
    }
}
