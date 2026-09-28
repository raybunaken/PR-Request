/**
 * GOOGLE APPS SCRIPT - KPR MORTGAGE OPERATIONS AUTOMATION
 * Akun Eksekusi: dzaky.rayssa@99.co
 *
 * Fitur:
 * 1. Otomasi penarikan file SPA (Surat Perjanjian Kerjasama) final signed dari Gmail (Dropbox Sign / 99 Group)
 *    dan penyimpanan otomatis ke folder Leads di Google Drive.
 * 2. Otomasi pencarian thread email Konfirmasi Plafond Bank, konversi thread email menjadi PDF persis format
 *    cetak native Gmail (Gmail Print to PDF) dengan logo 99 Group resmi.
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

  // 2. Ambil Email Konfirmasi Bank & Render ke PDF (Persis format cetak Gmail asli)
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

  // Tier 2: Token kata signifikan
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

  var targetFileName = 'SPA_' + customerName.replace(/[/\\?%*:|"<>]/g, '').trim() + '.pdf';

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
 * Cari thread email konfirmasi bank, render ke dokumen PDF persis seperti tampilan cetak native Gmail (Gmail Print to PDF)
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
  var userEmail = Session.getActiveUser().getEmail() || 'dzaky.rayssa@99.co';

  // Format HTML persis layout native Gmail Print / Save as PDF
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
  html += '<style>';
  html += '@page { margin: 25px 35px 25px 35px; }';
  html += 'body { font-family: Roboto, Arial, Helvetica, sans-serif; color: #222222; font-size: 13px; line-height: 1.45; margin: 0; padding: 0; }';
  html += '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }';
  html += '.logo-text { font-family: Arial, sans-serif; font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }';
  html += '.logo-sub { font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: 1.5px; margin-left: 2px; }';
  html += '.header-meta { text-align: right; font-size: 11px; color: #444; line-height: 1.4; vertical-align: top; }';
  html += '.subject-title { font-size: 19px; font-weight: bold; color: #202124; margin: 0 0 4px 0; line-height: 1.3; }';
  html += '.message-count { font-size: 12px; color: #5f6368; margin-bottom: 14px; }';
  html += '.main-divider { border: none; border-top: 1px solid #dadce0; margin: 0 0 20px 0; }';
  html += '.msg-item { margin-bottom: 22px; page-break-inside: avoid; }';
  html += '.msg-item-divider { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }';
  html += '.msg-meta-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }';
  html += '.msg-sender { font-size: 13px; color: #202124; }';
  html += '.msg-date { font-size: 11px; color: #5f6368; text-align: right; white-space: nowrap; vertical-align: top; }';
  html += '.msg-recipient { font-size: 12px; color: #5f6368; margin-bottom: 2px; }';
  html += '.msg-body { font-size: 13px; color: #202124; line-height: 1.5; margin-top: 12px; }';
  html += '.msg-body a { color: #1a73e8; text-decoration: underline; }';
  html += '.msg-body p { margin: 0 0 10px 0; }';
  html += '</style></head><body>';

  // 1. Top Header (Logo 99 GROUP di kiri, Mail info di kanan)
  html += '<table class="header-table"><tr>';
  html += '<td style="vertical-align: top;">';
  html += '<span class="logo-text">99</span><span class="logo-sub"> GROUP</span>';
  html += '</td>';
  html += '<td class="header-meta">';
  html += '<b>99.co Mail - ' + escapeHtml(threadSubject) + '</b><br/>';
  html += 'Dzaky Rayssa Buntoro &lt;' + escapeHtml(userEmail) + '&gt;';
  html += '</td></tr></table>';

  // 2. Thread Title & Message Count
  html += '<div class="subject-title">' + escapeHtml(threadSubject) + '</div>';
  html += '<div class="message-count">' + messages.length + ' messages</div>';
  html += '<hr class="main-divider" />';

  // 3. Messages List
  for (var mIdx = 0; mIdx < messages.length; mIdx++) {
    var curMsg = messages[mIdx];
    var fromStr = curMsg.getFrom() || '';
    var toStr = curMsg.getTo() || '';
    var ccStr = curMsg.getCc() || '';
    var dateFormatted = Utilities.formatDate(curMsg.getDate(), "GMT+7", "EEE, MMM d, yyyy 'at' h:mm a");
    var bodyHtml = curMsg.getBody() || '';

    html += '<div class="msg-item">';
    html += '<table class="msg-meta-table"><tr>';
    html += '<td class="msg-sender">' + formatSenderHeader(fromStr) + '</td>';
    html += '<td class="msg-date">' + dateFormatted + '</td>';
    html += '</tr></table>';

    if (toStr) {
      html += '<div class="msg-recipient">To: ' + escapeHtml(toStr) + '</div>';
    }
    if (ccStr) {
      html += '<div class="msg-recipient">Cc: ' + escapeHtml(ccStr) + '</div>';
    }

    html += '<div class="msg-body">' + bodyHtml + '</div>';
    html += '</div>';

    if (mIdx < messages.length - 1) {
      html += '<hr class="msg-item-divider" />';
    }
  }

  html += '</body></html>';

  var targetFileName = 'Konfirmasi Plafond - ' + bankWord + ' - ' + customerName.replace(/[/\\?%*:|"<>]/g, '').trim() + '.pdf';
  var htmlBlob = Utilities.newBlob(html, 'text/html', 'email_thread.html');
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

function formatSenderHeader(fromStr) {
  if (!fromStr) return '';
  var match = fromStr.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    var name = match[1].replace(/^["']|["']$/g, '').trim();
    var email = match[2].trim();
    return '<b>' + escapeHtml(name || email) + '</b> &lt;' + escapeHtml(email) + '&gt;';
  }
  return '<b>' + escapeHtml(fromStr) + '</b>';
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
