using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Letmein.Migrations
{
    /// <inheritdoc />
    public partial class AddRoomRemoteSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RemoteLink",
                table: "Rooms",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "SupportsRemote",
                table: "Rooms",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RemoteLink",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "SupportsRemote",
                table: "Rooms");
        }
    }
}
