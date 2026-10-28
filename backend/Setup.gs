/**
 * Run manually in a company-owned Apps Script project bound to the NPI spreadsheet.
 * This creates headers only. It does not publish a web app or grant file access.
 * Never store passwords, identity tokens or public Drive links in these tabs.
 */
function setupPhaseOne() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Bind this script to the management-owned NPI spreadsheet.');
  var schema = {
    UsersRoles: ['UserId', 'DisplayName', 'Role', 'ContractorId', 'SiteIds', 'Active'],
    Contractors: ['ContractorId', 'Name', 'Active'],
    Sites: ['SiteId', 'Name', 'Timezone', 'Active'],
    WorkAreas: ['AreaId', 'SiteId', 'Name', 'Active'],
    Equipment: ['EquipmentId', 'ContractorId', 'Name', 'Type', 'Active'],
    Assignments: ['AssignmentId', 'SiteId', 'AreaId', 'WorkerId', 'ContractorId', 'EquipmentId', 'Instructions', 'CreatedBy', 'CreatedAt'],
    WorkLogs: ['WorkLogId', 'AssignmentId', 'Status', 'StartAt', 'EndAt', 'TasksJson', 'Loads', 'Notes', 'LocationJson', 'Version', 'UpdatedAt'],
    StormEvents: ['StormId', 'SiteId', 'StartAt', 'EndAt', 'SnowfallCategory', 'Notes'],
    Attachments: ['AttachmentId', 'WorkLogId', 'DriveFileId', 'Kind', 'MimeType', 'SizeBytes', 'CreatedBy', 'CreatedAt'],
    WorkApprovals: ['ApprovalId', 'WorkLogId', 'Decision', 'Reason', 'ReviewedBy', 'ReviewedAt', 'RecordVersion'],
    AuditLog: ['EventId', 'EntityType', 'EntityId', 'Action', 'ActorId', 'At', 'RecordVersion', 'DetailsJson'],
    IdempotencyKeys: ['UserId', 'RequestId', 'Action', 'EntityId', 'ResultJson', 'CreatedAt']
  };
  // Validate all existing headers before making any changes.
  Object.keys(schema).forEach(function(name) {
    var sheet = book.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 0) {
      var expected = schema[name];
      var actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expected.length)).getValues()[0];
      if (actual.length !== expected.length || actual.some(function(value, i) { return value !== expected[i]; })) {
        throw new Error('Existing headers differ in ' + name + '. Review manually; nothing was overwritten.');
      }
    }
  });
  Object.keys(schema).forEach(function(name) {
    var sheet = book.getSheetByName(name) || book.insertSheet(name);
    if (!sheet.getLastRow()) {
      sheet.getRange(1, 1, 1, schema[name].length).setValues([schema[name]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, schema[name].length).setFontWeight('bold').setBackground('#142f43').setFontColor('#ffffff');
    }
  });
  SpreadsheetApp.flush();
  return Object.keys(schema);
}
