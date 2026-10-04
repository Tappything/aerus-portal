const PDFDocument = require('pdfkit');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    const type = payload.type || 'PROPOSAL';
    const customerName = payload.customer_name || 'Anne Smith';
    const customerAddress = payload.customer_address || '648 Stansbury Road, Pylesville MD 21132';
    const items = Array.isArray(payload.items) && payload.items.length > 0 
      ? payload.items 
      : [{ description: 'Aerus Whole Home Water Treatment System & Professional Installation', amount: '7500.00' }];
    const totalAmount = payload.total ? parseFloat(payload.total).toFixed(2) : '7500.00';
    const businessName = payload.business_name || 'Aerus Home Wellness';
    const businessAddress = payload.business_address || 'Timonium, MD';
    const businessPhone = payload.business_phone || '(443) 413-9876';

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header / Branding
      doc
        .fillColor('#0f172a')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(businessName.toUpperCase(), 50, 45);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`${businessAddress} • ${businessPhone}`, 50, 72);

      // Document Badge
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#0284c7')
        .text(type.toUpperCase(), 400, 45, { align: 'right' });

      doc
        .moveTo(50, 90)
        .lineTo(562, 90)
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .stroke();

      // Customer Info Box
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text('PREPARED FOR:', 50, 110);

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#1e293b')
        .text(customerName, 50, 125);

      if (customerAddress) {
        doc
          .fontSize(9)
          .fillColor('#475569')
          .text(customerAddress, 50, 140, { width: 250 });
      }

      // Date Header
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`Date: ${currentDate}`, 400, 110, { align: 'right' });

      // Table Headers
      const tableTop = 200;
      doc
        .rect(50, tableTop, 512, 22)
        .fill('#f8fafc');

      doc
        .fillColor('#475569')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('ITEM DESCRIPTION', 60, tableTop + 6)
        .text('AMOUNT', 450, tableTop + 6, { width: 100, align: 'right' });

      // Itemized List
      let yPosition = tableTop + 30;

      items.forEach((item) => {
        const desc = item.description || 'Service / Product';
        const amt = item.amount ? parseFloat(item.amount).toFixed(2) : '0.00';

        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#0f172a')
          .text(desc, 60, yPosition, { width: 380 })
          .text(`$${amt}`, 450, yPosition, { width: 100, align: 'right' });

        yPosition += 25;

        doc
          .moveTo(50, yPosition - 8)
          .lineTo(562, yPosition - 8)
          .strokeColor('#f1f5f9')
          .lineWidth(0.5)
          .stroke();
      });

      // Total Section
      yPosition += 10;
      doc
        .rect(350, yPosition, 212, 30)
        .fill('#0f172a');

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#ffffff')
        .text('TOTAL PROPOSAL:', 365, yPosition + 9)
        .text(`$${totalAmount}`, 450, yPosition + 9, { width: 100, align: 'right' });

      // Signature Block
      const sigTop = Math.max(yPosition + 80, 580);

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0f172a')
        .text('ACCEPTANCE OF PROPOSAL', 50, sigTop);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          'Signature below authorizes execution of this proposal according to terms agreed upon.',
          50,
          sigTop + 14,
          { width: 450 }
        );

      doc
        .moveTo(50, sigTop + 65)
        .lineTo(280, sigTop + 65)
        .strokeColor('#94a3b8')
        .lineWidth(1)
        .stroke();

      doc
        .moveTo(330, sigTop + 65)
        .lineTo(512, sigTop + 65)
        .strokeColor('#94a3b8')
        .lineWidth(1)
        .stroke();

      doc
        .fontSize(8)
        .fillColor('#64748b')
        .text('Authorized Signature (Anne Smith)', 50, sigTop + 70)
        .text('Date', 330, sigTop + 70);

      doc.end();
    });

    const base64Pdf = pdfBuffer.toString('base64');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        type,
        customer_name: customerName,
        total: totalAmount,
        pdf_base64: base64Pdf,
        mime_type: 'application/pdf',
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
