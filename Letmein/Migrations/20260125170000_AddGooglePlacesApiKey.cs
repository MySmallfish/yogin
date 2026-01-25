using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Letmein.Migrations
{
    /// <inheritdoc />
    public partial class AddGooglePlacesApiKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GooglePlacesApiKey",
                table: "Studios",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GooglePlacesApiKey",
                table: "Studios");
        }
    }
}
