using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Letmein.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerTagsJson",
                table: "Studios",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomerTagsJson",
                table: "Studios");
        }
    }
}
