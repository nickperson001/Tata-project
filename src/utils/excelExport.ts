import ExcelJS from 'exceljs';

interface SheetColumn {
  header: string;
  key: string;
  width?: number;
}

interface SheetDef {
  name: string;
  columns: SheetColumn[];
  rows: Record<string, any>[];
}

export async function generateExcel(sheets: SheetDef[], filename: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tata Business Suite';
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name, { properties: { tabColor: { argb: 'FF10B981' } } });

    ws.columns = sheet.columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width || 18,
    }));

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.rows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((cell: any, j: number) => {
        if (j > 0 && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      });
      if (i % 2 === 0) {
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      }
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: sheet.columns.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
