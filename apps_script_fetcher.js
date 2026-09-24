/**
 * GOOGLE APPS SCRIPT - KPR MORTGAGE OPERATIONS AUTOMATION
 * Akun Eksekusi: dzaky.rayssa@99.co
 *
 * Fitur:
 * 1. Otomasi penarikan file SPA (Surat Perjanjian Kerjasama) final signed dari Gmail (Dropbox Sign / 99 Group)
 *    dan penyimpanan otomatis ke folder Leads di Google Drive.
 * 2. Otomasi pencarian thread email Konfirmasi Plafond Bank, konversi thread email menjadi PDF resmi,
 *    dan penyimpanan otomatis ke folder Leads di Google Drive.
 * 3. Fallback pencarian cerdas berbasis token/nama nasabah untuk mengantisipasi perbedaan ejaan nama (Case 1).
 */

function doGet(e) {
  var result = {
    status: 'ok',
    service: 'KPR SPA and Bank Email Automation',
    account: Session.getActiveUser().getEmail(),
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var responseData = { success: false };
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = payload.action || '';

    if (action === 'ping') {
      responseData = {
        success: true,
        message: 'Apps Script Web App aktif dan terhubung.',
        account: Session.getActiveUser().getEmail(),
        timestamp: new Date().toISOString()
      };
    } else if (action === 'fetch_spa_and_email' || action === 'fetch_files') {
      responseData = executeFetchSpaAndBankEmail(
        payload.folderId,
        payload.customerName,
        payload.bankName,
        payload.moCode,
        payload.customSpaQuery,
        payload.customBankQuery
      );
    } else if (payload.row) {
      // Handler legacy untuk pemrosesan baris PR
      responseData = {
        success: true,
        message: 'Row ' + payload.row + ' diterima via Apps Script.',
        row: payload.row
      };
    } else {
      responseData = {
        success: true,
        message: 'Apps Script Web App menerima request tanpa aksi spesifik.',
        receivedPayload: payload
      };
    }
  } catch (err) {
    responseData = {
      success: false,
      error: err.toString(),
      stack: err.stack
    };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Eksekusi utama penarikan berkas SPA dan Email Konfirmasi Bank
 */
function executeFetchSpaAndBankEmail(folderId, customerName, bankName, moCode, customSpaQuery, customBankQuery) {
  if (!folderId) {
    return { success: false, error: 'folderId wajib disertakan.' };
  }
  if (!customerName) {
    return { success: false, error: 'customerName wajib disertakan.' };
  }

  var targetFolder;
  try {
    targetFolder = DriveApp.getFolderById(folderId);
  } catch (err) {
    return { success: false, error: 'Folder Google Drive tidak ditemukan dengan ID: ' + folderId };
  }

  var custClean = String(customerName || '').trim();
  var bankClean = String(bankName || '').trim();
  var moClean = String(moCode || '').trim();

  // 1. Ambil SPA Signed Attachment
  var spaResult = fetchSpaSignedAttachment(targetFolder, custClean, bankClean, customSpaQuery);

  // 2. Ambil Email Konfirmasi Bank & Render ke PDF
  var bankEmailResult = fetchBankEmailAndExportPdf(targetFolder, custClean, bankClean, moClean, customBankQuery);

  return {
    success: true,
    folderId: folderId,
    folderName: targetFolder.getName(),
    customerName: custClean,
    bankName: bankClean,
    moCode: moClean,
    spa: spaResult,
    bankEmail: bankEmailResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * Cari email SPA final signed dan simpan lampiran PDF ke Google Drive
 */
function fetchSpaSignedAttachment(targetFolder, customerName, bankName, customQuery) {
  var cleanNameOnly = customerName.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  var words = cleanNameOnly.split(' ').filter(function(w) {
    var l = w.toLowerCase();
    return l.length >= 3 && !['pt', 'cv', 'dan', 'the', 'kpr', 'tbk'].includes(l);
  });
  var bankWord = (bankName || '').split(' ')[0] || '';

  var queries = [];
  if (customQuery && customQuery.trim()) {
    queries.push(customQuery.trim());
  }

  // Tier 1: Pencarian presisi nama lengkap nasabah + bank + SPA + signed
  queries.push('"SPA" "signed" "' + cleanNameOnly + '" "' + bankWord + '" has:attachment');
  queries.push('"SPA" "signed" "' + cleanNameOnly + '" has:attachment');

  // Tier 2: Token kata signifikan (Case 1: variasi nama atau singkatan)
  if (words.length >= 2) {
    queries.push('"SPA" "signed" "' + words[0] + '" "' + words[1] + '" "' + bankWord + '" has:attachment');
    queries.push('"SPA" "signed" "' + words[0] + '" "' + words[1] + '" has:attachment');
  }
  if (words.length >= 1) {
    queries.push('"SPA" "signed" "' + words[0] + '" "' + bankWord + '" has:attachment');
    queries.push('"SPA" "signed" "' + words[0] + '" has:attachment');
  }

  // Tier 3: Subject SPA dengan nama nasabah / pengirim Dropbox Sign / 99 Group
  queries.push('subject:"SPA" "' + cleanNameOnly + '" has:attachment');
  if (words.length >= 1) {
    queries.push('subject:"SPA" "' + words[0] + '" has:attachment');
  }
  queries.push('from:("99 Group" OR "Dropbox Sign" OR "advertise@99.co") "' + cleanNameOnly + '" has:attachment');

  var matchedThread = null;
  var matchedMessage = null;
  var matchedAttachment = null;
  var queryUsed = '';

  for (var i = 0; i < queries.length; i++) {
    var q = queries[i];
    try {
      var threads = GmailApp.search(q, 0, 5);
      for (var t = 0; t < threads.length; t++) {
        var th = threads[t];
        var msgs = th.getMessages();

        for (var m = 0; m < msgs.length; m++) {
          var msg = msgs[m];
          var subject = msg.getSubject() || '';
          var subLower = subject.toLowerCase();

          // Abaikan email notifikasi in-progress atau viewing
          if (subLower.indexOf('has viewed') !== -1 ||
              subLower.indexOf('has started') !== -1 ||
              subLower.indexOf('invitation to sign') !== -1) {
            continue;
          }

          var isSigned = subLower.indexOf('signed') !== -1 ||
                         subLower.indexOf('copied on spa') !== -1 ||
                         subLower.indexOf('completed') !== -1;
          var hasSpaInSub = subLower.indexOf('spa') !== -1;

          var atts = msg.getAttachments();
          for (var a = 0; a < atts.length; a++) {
            var att = atts[a];
            var attName = att.getName() || '';
            var attLower = attName.toLowerCase();
            var isPdf = att.getContentType() === 'application/pdf' || attLower.indexOf('.pdf') !== -1;

            if (isPdf) {
              if (isSigned || hasSpaInSub || attLower.indexOf('spa') !== -1) {
                // Verifikasi kemiripan dengan token nasabah
                var matchesToken = words.length === 0 || words.some(function(w) {
                  return subLower.indexOf(w.toLowerCase()) !== -1 || attLower.indexOf(w.toLowerCase()) !== -1;
                });

                if (matchesToken) {
                  matchedThread = th;
                  matchedMessage = msg;
                  matchedAttachment = att;
                  queryUsed = q;
                  break;
                }
              }
            }
          }
          if (matchedAttachment) break;
        }
        if (matchedAttachment) break;
      }
      if (matchedAttachment) break;
    } catch (err) {
      Logger.log('Search error for query: ' + q + ' -> ' + err.message);
    }
  }

  if (!matchedAttachment) {
    return {
      found: false,
      message: 'Tidak ditemukan email SPA signed di Gmail untuk nasabah ' + customerName,
      queriesTested: queries.slice(0, 4)
    };
  }

  // Nama file target standar di Google Drive
  var targetFileName = 'SPA_' + customerName.replace(/[/\\?%*:|"<>]/g, '').trim() + '.pdf';

  // Periksa apakah file sudah ada di folder untuk mencegah duplikasi
  var existingFiles = targetFolder.getFilesByName(targetFileName);
  var driveFile;
  if (existingFiles.hasNext()) {
    var existing = existingFiles.next();
    existing.setContent(matchedAttachment.copyBlob().getBytes());
    driveFile = existing;
  } else {
    driveFile = targetFolder.createFile(matchedAttachment.copyBlob().setName(targetFileName));
  }

  return {
    found: true,
    fileId: driveFile.getId(),
    fileName: driveFile.getName(),
    fileUrl: driveFile.getUrl(),
    subject: matchedMessage.getSubject(),
    sender: matchedMessage.getFrom(),
    date: matchedMessage.getDate().toISOString(),
    queryUsed: queryUsed
  };
}

/**
 * Cari thread email konfirmasi bank, render ke dokumen PDF dan simpan ke Google Drive
 */
function fetchBankEmailAndExportPdf(targetFolder, customerName, bankName, moCode, customQuery) {
  var cleanNameOnly = customerName.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  var words = cleanNameOnly.split(' ').filter(function(w) {
    var l = w.toLowerCase();
    return l.length >= 3 && !['pt', 'cv', 'dan', 'the', 'kpr', 'tbk'].includes(l);
  });
  var bankWord = (bankName || '').split(' ')[0] || '';

  var queries = [];
  if (customQuery && customQuery.trim()) {
    queries.push(customQuery.trim());
  }

  // Tier 1: Subjek "Konfirmasi plafond" + Bank + Nama Nasabah
  queries.push('subject:"Konfirmasi plafond" "' + bankWord + '" "' + cleanNameOnly + '"');
  queries.push('subject:"Konfirmasi plafond" "' + cleanNameOnly + '"');

  // Tier 2: Subjek "Konfirmasi plafond" + Bank + Kata Kunci Nasabah
  if (words.length >= 1) {
    queries.push('subject:"Konfirmasi plafond" "' + bankWord + '" "' + words[0] + '"');
    queries.push('subject:"Konfirmasi plafond" "' + words[0] + '"');
  }

  // Tier 3: Subjek "Konfirmasi" + Bank + Nama Nasabah
  queries.push('subject:"Konfirmasi" "' + bankWord + '" "' + cleanNameOnly + '"');
  queries.push('"Konfirmasi" "' + cleanNameOnly + '" "' + bankWord + '"');

  // Tier 4: Body pencarian teks akad/done
  queries.push('"' + cleanNameOnly + '" "done akad"');
  queries.push('"' + cleanNameOnly + '" "plafond"');
  if (words.length >= 2) {
    queries.push('"' + words[0] + '" "' + words[1] + '" "plafond"');
  }

  var matchedThread = null;
  var queryUsed = '';

  for (var i = 0; i < queries.length; i++) {
    var q = queries[i];
    try {
      var threads = GmailApp.search(q, 0, 5);
      for (var t = 0; t < threads.length; t++) {
        var th = threads[t];
        var msgs = th.getMessages();
        var mentionsCust = false;

        for (var m = 0; m < msgs.length; m++) {
          var msg = msgs[m];
          var body = (msg.getPlainBody() || '').toLowerCase();
          var sub = (msg.getSubject() || '').toLowerCase();

          if (sub.indexOf(cleanNameOnly.toLowerCase()) !== -1 || body.indexOf(cleanNameOnly.toLowerCase()) !== -1) {
            mentionsCust = true;
            break;
          }
          if (words.length > 0 && words.some(function(w) { return body.indexOf(w.toLowerCase()) !== -1; })) {
            mentionsCust = true;
            break;
          }
        }

        if (mentionsCust) {
          matchedThread = th;
          queryUsed = q;
          break;
        }
      }
      if (matchedThread) break;
    } catch (err) {
      Logger.log('Search error for bank query: ' + q + ' -> ' + err.message);
    }
  }

  if (!matchedThread) {
    return {
      found: false,
      message: 'Tidak ditemukan email konfirmasi bank di Gmail untuk nasabah ' + customerName,
      queriesTested: queries.slice(0, 4)
    };
  }

  var messages = matchedThread.getMessages();
  var threadSubject = matchedThread.getFirstMessageSubject() || 'Konfirmasi Plafond Akad Bank';

  // Format thread email menjadi dokumen HTML bersih
  var htmlContent = '<!DOCTYPE html><html><head><meta charset="utf-8">';
  htmlContent += '<style>';
  htmlContent += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 25px; line-height: 1.5; font-size: 13px; }';
  htmlContent += '.doc-header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }';
  htmlContent += '.doc-title { font-size: 17px; font-weight: bold; color: #0f172a; margin: 0 0 6px 0; }';
  htmlContent += '.meta-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }';
  htmlContent += '.meta-table td { padding: 4px 6px; }';
  htmlContent += '.meta-label { font-weight: 600; color: #64748b; width: 130px; }';
  htmlContent += '.msg-box { border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 18px; background: #ffffff; overflow: hidden; page-break-inside: avoid; }';
  htmlContent += '.msg-header { background: #f8fafc; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }';
  htmlContent += '.msg-header div { margin-bottom: 3px; }';
  htmlContent += '.msg-body { padding: 14px; font-size: 13px; color: #334155; }';
  htmlContent += '.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #dbeafe; color: #1e40af; }';
  htmlContent += '.footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; }';
  htmlContent += '</style></head><body>';

  htmlContent += '<div class="doc-header">';
  htmlContent += '<div class="doc-title">ARSIP EMAIL KONFIRMASI PLAFOND AKAD BANK</div>';
  htmlContent += '<table class="meta-table">';
  htmlContent += '<tr><td class="meta-label">Nasabah Debitur:</td><td><b>' + escapeHtml(customerName) + '</b></td>';
  htmlContent += '<td class="meta-label">Bank Rekanan:</td><td><b>' + escapeHtml(bankName || '-') + '</b></td></tr>';
  htmlContent += '<tr><td class="meta-label">Kode #MO:</td><td><b>' + escapeHtml(moCode || '-') + '</b></td>';
  htmlContent += '<td class="meta-label">Waktu Export:</td><td>' + new Date().toLocaleString('id-ID') + '</td></tr>';
  htmlContent += '<tr><td class="meta-label">Subjek Email:</td><td colspan="3"><b>' + escapeHtml(threadSubject) + '</b></td></tr>';
  htmlContent += '</table></div>';

  for (var mIdx = 0; mIdx < messages.length; mIdx++) {
    var curMsg = messages[mIdx];
    var fromStr = curMsg.getFrom();
    var toStr = curMsg.getTo();
    var dateStr = curMsg.getDate().toLocaleString('id-ID');
    var rawBody = curMsg.getBody();

    htmlContent += '<div class="msg-box">';
    htmlContent += '<div class="msg-header">';
    htmlContent += '<div><span class="badge">Pesan #' + (mIdx + 1) + '</span> &nbsp; <b>Dari:</b> ' + escapeHtml(fromStr) + '</div>';
    htmlContent += '<div><b>Kepada:</b> ' + escapeHtml(toStr) + '</div>';
    htmlContent += '<div><b>Waktu:</b> ' + dateStr + '</div>';
    htmlContent += '</div>';
    htmlContent += '<div class="msg-body">' + rawBody + '</div>';
    htmlContent += '</div>';
  }

  htmlContent += '<div class="footer">Dokumen ini diexport secara otomatis dari kotak masuk Gmail resmi (dzaky.rayssa@99.co) untuk kelengkapan audit Finance.</div>';
  htmlContent += '</body></html>';

  var targetFileName = 'Konfirmasi Plafond - ' + bankWord + ' - ' + customerName.replace(/[/\\?%*:|"<>]/g, '').trim() + '.pdf';
  var htmlBlob = Utilities.newBlob(htmlContent, 'text/html', 'email_thread.html');
  var pdfBlob = htmlBlob.getAs('application/pdf').setName(targetFileName);

  var existingFiles = targetFolder.getFilesByName(targetFileName);
  var driveFile;
  if (existingFiles.hasNext()) {
    var existing = existingFiles.next();
    existing.setContent(pdfBlob.getBytes());
    driveFile = existing;
  } else {
    driveFile = targetFolder.createFile(pdfBlob);
  }

  return {
    found: true,
    fileId: driveFile.getId(),
    fileName: driveFile.getName(),
    fileUrl: driveFile.getUrl(),
    threadSubject: threadSubject,
    messageCount: messages.length,
    queryUsed: queryUsed
  };
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fungsi uji coba (bisa dijalankan langsung di Apps Script Editor untuk verifikasi otorisasi)
 */
function testSearch() {
  var testCustomer = "PT Sinergi Lintas Global";
  var testBank = "Danamon";
  Logger.log("Testing search for: " + testCustomer + " - " + testBank);

  var threads = GmailApp.search('"SPA" "' + testCustomer + '"', 0, 5);
  Logger.log("Found threads: " + threads.length);
  for (var i = 0; i < threads.length; i++) {
    Logger.log("Thread " + (i + 1) + ": " + threads[i].getFirstMessageSubject());
  }
}
