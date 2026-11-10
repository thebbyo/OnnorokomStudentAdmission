using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Admission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdmissionNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Hands out admission numbers: unique, never reused, assigned once per confirmed admission.
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS admission_no_seq START 1");

            migrationBuilder.AddColumn<long>(
                name: "admission_no",
                table: "holds",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_holds_admission_no",
                table: "holds",
                column: "admission_no",
                unique: true,
                filter: "admission_no IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS admission_no_seq");

            migrationBuilder.DropIndex(
                name: "ux_holds_admission_no",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "admission_no",
                table: "holds");
        }
    }
}
