using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Letmein.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanLimitsAndInstanceOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DailyLimit",
                table: "Plans",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RemoteOnly",
                table: "Plans",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ValidityDays",
                table: "Plans",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AllowedPlanIdsJson",
                table: "EventInstances",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "EventInstances",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "EventInstances",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "EventInstances",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "EventInstances",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailyLimit",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "RemoteOnly",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "ValidityDays",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "AllowedPlanIdsJson",
                table: "EventInstances");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "EventInstances");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "EventInstances");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "EventInstances");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "EventInstances");
        }
    }
}
