using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Letmein.Migrations
{
    /// <inheritdoc />
    public partial class AddRemoteAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RemoteCapacity",
                table: "EventSeries",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "RemoteInviteUrl",
                table: "EventSeries",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "RemoteCapacity",
                table: "EventInstances",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "RemoteInviteUrl",
                table: "EventInstances",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsRemote",
                table: "Bookings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RemoteCapacity",
                table: "EventSeries");

            migrationBuilder.DropColumn(
                name: "RemoteInviteUrl",
                table: "EventSeries");

            migrationBuilder.DropColumn(
                name: "RemoteCapacity",
                table: "EventInstances");

            migrationBuilder.DropColumn(
                name: "RemoteInviteUrl",
                table: "EventInstances");

            migrationBuilder.DropColumn(
                name: "IsRemote",
                table: "Bookings");
        }
    }
}
