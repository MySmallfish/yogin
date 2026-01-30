using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Letmein.Migrations
{
    /// <inheritdoc />
    public partial class BillingModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BillableItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudioId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    DefaultPriceCents = table.Column<int>(type: "INTEGER", nullable: false),
                    Currency = table.Column<string>(type: "TEXT", nullable: false),
                    TaxBehavior = table.Column<string>(type: "TEXT", nullable: false),
                    MetadataJson = table.Column<string>(type: "TEXT", nullable: false),
                    Active = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillableItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BillingChargeLineItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ChargeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    BillableItemId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    UnitPriceCents = table.Column<int>(type: "INTEGER", nullable: false),
                    LineSubtotalCents = table.Column<int>(type: "INTEGER", nullable: false),
                    TaxCents = table.Column<int>(type: "INTEGER", nullable: false),
                    LineTotalCents = table.Column<int>(type: "INTEGER", nullable: false),
                    MetadataJson = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingChargeLineItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BillingCharges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudioId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CustomerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ChargeDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DueDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Currency = table.Column<string>(type: "TEXT", nullable: false),
                    SubtotalCents = table.Column<int>(type: "INTEGER", nullable: false),
                    TaxCents = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalCents = table.Column<int>(type: "INTEGER", nullable: false),
                    SourceType = table.Column<string>(type: "TEXT", nullable: false),
                    SourceId = table.Column<Guid>(type: "TEXT", nullable: true),
                    BillingPeriodStart = table.Column<DateTime>(type: "TEXT", nullable: true),
                    BillingPeriodEnd = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Note = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    VoidedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    VoidReason = table.Column<string>(type: "TEXT", nullable: false),
                    OriginalChargeId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingCharges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BillingSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudioId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CustomerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    BillableItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    StartDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    BillingInterval = table.Column<int>(type: "INTEGER", nullable: false),
                    BillingAnchorDay = table.Column<int>(type: "INTEGER", nullable: false),
                    NextChargeDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PriceOverrideCents = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CanceledAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    PausedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ResumedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingSubscriptions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BillableItems_StudioId_Name",
                table: "BillableItems",
                columns: new[] { "StudioId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_BillingChargeLineItems_ChargeId",
                table: "BillingChargeLineItems",
                column: "ChargeId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingCharges_StudioId_ChargeDate",
                table: "BillingCharges",
                columns: new[] { "StudioId", "ChargeDate" });

            migrationBuilder.CreateIndex(
                name: "IX_BillingCharges_StudioId_SourceType_SourceId_BillingPeriodStart",
                table: "BillingCharges",
                columns: new[] { "StudioId", "SourceType", "SourceId", "BillingPeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingSubscriptions_StudioId_CustomerId_Status",
                table: "BillingSubscriptions",
                columns: new[] { "StudioId", "CustomerId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillableItems");

            migrationBuilder.DropTable(
                name: "BillingChargeLineItems");

            migrationBuilder.DropTable(
                name: "BillingCharges");

            migrationBuilder.DropTable(
                name: "BillingSubscriptions");
        }
    }
}
