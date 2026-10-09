/**
 * ============================================================================
 * UNIFIED GOOGLE APPS SCRIPT - 99 GROUP KPR OPERATIONS SUITE
 * Akun Eksekusi: dzaky.rayssa@99.co
 * ============================================================================
 * 
 * Skrip terpadu untuk:
 * 1. PR Request & Agreement Generator:
 *    - Menyalin template resmi Google Spreadsheet PR Request native (Bukan .xlsx)
 *    - Mengunggah Agreement Komisi Agen PDF 4 halaman
 *    - Memastikan shortcut PKS Bank terpasang
 * 2. Leads Folder File Automation:
 *    - Menarik SPA signed attachment dari Gmail ke folder Leads nasabah
 *    - Menarik email konfirmasi plafond/akad dari PIC Bank dan merender ke PDF
 *      dengan format native print Gmail resmi 99 Group
 *    - Membersihkan berkas salah tempat secara otomatis
 */

var TEMPLATE_PR_ID = "1QlRwxUp9taMCfYLqwOxfEShTGGIX3Btat2GsI_GOqtQ";

function doGet(e) {
  var result = {
    status: "ok",
    service: "Unified KPR Operations Suite (PR & Leads Automation)",
    account: Session.getActiveUser().getEmail(),
    time: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var responseData = { success: false };
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = (payload.action || '').trim().toLowerCase();

    if (action === 'ping') {
      responseData = {
        success: true,
        message: 'Unified Apps Script Web App aktif dan terhubung.',
        account: Session.getActiveUser().getEmail(),
        timestamp: new Date().toISOString()
      };
    } else if (action === 'fetch_spa_and_email' || action === 'fetch_files') {
      // ROUTE 1: Penarikan berkas Leads (SPA Signed + Email Konfirmasi Bank)
      responseData = executeFetchSpaAndBankEmail(
        payload.folderId,
        payload.customerName,
        payload.bankName,
        payload.moCode,
        payload.customSpaQuery,
        payload.customBankQuery
      );
    } else if (action === 'create_pr_and_agreement' || payload.amount || payload.agentName || payload.prFileName) {
      // ROUTE 2: Pembuatan PR Request & Upload Agreement PDF
      responseData = executeCreatePRAndAgreement(payload);
    } else {
      responseData = {
        success: false,
        error: 'Aksi tidak valid atau parameter tidak lengkap. Gunakan action: "fetch_spa_and_email" atau kirim data PR.'
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
 * ============================================================================
 * BAGIAN 1: PEMBUATAN PR REQUEST SPREADSHEET & AGREEMENT PDF
 * ============================================================================
 */
function executeCreatePRAndAgreement(data) {
  if (!data.folderId) {
    return { success: false, error: "Parameter folderId tidak ditemukan" };
  }

  var folder = DriveApp.getFolderById(data.folderId);
  var result = { success: true };

  // 1. Bersihkan berkas PR Request atau Agreement lama di folder PR ini agar tidak duplikat
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var fname = f.getName().toLowerCase();
    if (fname.indexOf('pr request') !== -1 || fname.indexOf('agreement') !== -1) {
      f.setTrashed(true);
    }
  }

  // 2. Buat Spreadsheet PR Request NATIVE dari Template Resmi Google Spreadsheet (Bukan .xlsx)
  var prName = data.prFileName || ("PR Request - Referral Fee Agent a.n. " + (data.agentName || 'Agent') + " - " + (data.customerName || 'Customer'));
  prName = prName.replace(/\.xlsx$/i, '');

  var template = DriveApp.getFileById(TEMPLATE_PR_ID);
  var newPrFile = template.makeCopy(prName, folder);
  var newSs = SpreadsheetApp.openById(newPrFile.getId());
  var prSheet = newSs.getSheetByName("PR Request") || newSs.getSheets()[0];

  // Isi sel PR Request
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'M/d/yy');
  prSheet.getRange('G11').setValue(dateStr);
  prSheet.getRange('D12').setValue(data.company || 'PT. Web Marketing Indonesia');
  prSheet.getRange('D13').setValue('Fransisca Octarina');
  prSheet.getRange('D14').setValue('CEO Team');
  prSheet.getRange('D15').setValue('Referral Fee Agent ' + (data.agentPayeeName || data.agentName || ''));
  prSheet.getRange('D17').setValue(data.agentPayeeName || data.agentName || '');
  prSheet.getRange('D19').setValue(data.agentBankName || '');
  prSheet.getRange('D20').setValue(data.agentAccountNumber || '');
  prSheet.getRange('D21').setValue(data.agentAccountName || data.agentPayeeName || data.agentName || '');

  var amountNum = Number(data.amount) || 0;
  prSheet.getRange('D22').setValue(amountNum);

  prSheet.getRange('C25').setValue('Mortgage - Agent transaction\nCommission sharing a.n. ' + (data.customerName || ''));
  prSheet.getRange('F25').setValue('Cost Mortgage - Agent Transaction');
  prSheet.getRange('G25').setFormula('=D22');
  prSheet.getRange('G32').setFormula('=G25');

  var richLink = SpreadsheetApp.newRichTextValue()
    .setText(data.customerName || 'Folder Drive')
    .setLinkUrl(folder.getUrl())
    .build();
  prSheet.getRange('D34').setRichTextValue(richLink);

  prSheet.getRange('B38').setValue('Fransisca Octarina');
  prSheet.getRange('D38').setValue('Cheung Yik');

  SpreadsheetApp.flush();

  result.prUrl = newPrFile.getUrl();
  result.prId = newPrFile.getId();

  // 3. Simpan Agreement PDF (.pdf 4 Halaman Utuh)
  if (data.agreementBase64 && data.agreementFileName) {
    var agrBlob = Utilities.newBlob(
      Utilities.base64Decode(data.agreementBase64),
      'application/pdf',
      data.agreementFileName
    );
    var agrFile = folder.createFile(agrBlob);
    result.agreementUrl = agrFile.getUrl();
    result.agreementId = agrFile.getId();
  }

  // 4. Pastikan berkas PKS Bank ada di folder nasabah jika belum ada
  if (data.bankName) {
    var hasPks = false;
    var currentFiles = folder.getFiles();
    while (currentFiles.hasNext()) {
      if (currentFiles.next().getName().toLowerCase().indexOf('pks') !== -1) {
        hasPks = true;
        break;
      }
    }
    if (!hasPks) {
      var rawBank = (data.bankName || '').toLowerCase().trim();
      var bankKeywords = ['danamon', 'sinarmas', 'maybank', 'permata', 'muamalat', 'mandiri', 'ganesha', 'cimb', 'uob', 'bsi', 'ina'];
      var targetKeyword = '';
      for (var k = 0; k < bankKeywords.length; k++) {
        if (rawBank.indexOf(bankKeywords[k]) !== -1) {
          targetKeyword = bankKeywords[k];
          break;
        }
      }
      if (targetKeyword) {
        var pksFiles = DriveApp.searchFiles("title contains 'PKS' and trashed = false");
        while (pksFiles.hasNext()) {
          var pf = pksFiles.next();
          var pfName = pf.getName().toLowerCase();
          if (targetKeyword === 'ina') {
            if (/\bina\b/i.test(pfName) && pfName.indexOf('sinarmas') === -1) {
              pf.makeCopy(pf.getName(), folder);
              break;
            }
          } else if (pfName.indexOf(targetKeyword) !== -1) {
            pf.makeCopy(pf.getName(), folder);
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * ============================================================================
 * BAGIAN 2: PENARIKAN BERKAS LEADS (SPA SIGNED + EMAIL KONFIRMASI BANK)
 * ============================================================================
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

  // 1. Bersihkan berkas PR Request yang tidak sengaja terbuat di folder Leads ini
  try {
    var cFiles = targetFolder.getFiles();
    while (cFiles.hasNext()) {
      var cf = cFiles.next();
      var cfName = cf.getName().toLowerCase();
      if (cfName.indexOf('pr request') !== -1 || (cfName.indexOf('agreement pembagian komisi') !== -1)) {
        cf.setTrashed(true);
      }
    }
  } catch (cleanErr) {
    Logger.log('Gagal membersihkan file PR nyasar: ' + cleanErr.message);
  }

  var custClean = String(customerName || '').trim();
  var bankClean = String(bankName || '').trim();
  var moClean = String(moCode || '').trim();

  // 2. Ambil SPA Signed Attachment
  var spaResult = fetchSpaSignedAttachment(targetFolder, custClean, bankClean, customSpaQuery);

  // 3. Ambil Email Konfirmasi Bank & Render ke PDF (Persis format cetak Gmail asli)
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
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }
  var driveFile = targetFolder.createFile(matchedAttachment.copyBlob().setName(targetFileName));

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

  // Filter anti-false-positive: abaikan sistem tanda tangan SPA dan notifikasi otomatis
  var antiFilters = ' -subject:"SPA" -from:hellosign.com -from:dropboxsign.com -from:docusign.net';

  var queries = [];
  if (customQuery && customQuery.trim()) {
    queries.push(customQuery.trim());
  }

  // Tier 1: Pencarian komprehensif subjek konfirmasi / konfirmasi plafond + bank + nasabah
  if (bankWord) {
    queries.push('subject:"Konfirmasi" "' + bankWord + '" "' + cleanNameOnly + '"' + antiFilters);
    queries.push('subject:"Konfirmasi plafond" "' + bankWord + '" "' + cleanNameOnly + '"' + antiFilters);
    queries.push('"' + cleanNameOnly + '" "' + bankWord + '" "konfirmasi"' + antiFilters);
    queries.push('"' + cleanNameOnly + '" "' + bankWord + '" "plafond"' + antiFilters);
  }
  queries.push('subject:"Konfirmasi" "' + cleanNameOnly + '"' + antiFilters);
  queries.push('subject:"Konfirmasi plafond" "' + cleanNameOnly + '"' + antiFilters);
  queries.push('"' + cleanNameOnly + '" "konfirmasi" "plafond"' + antiFilters);

  // Tier 2: Subjek "Konfirmasi" + Bank + Kata Kunci Nasabah
  if (words.length >= 1) {
    if (bankWord) {
      queries.push('subject:"Konfirmasi" "' + bankWord + '" "' + words[0] + '"' + antiFilters);
      queries.push('subject:"Konfirmasi plafond" "' + bankWord + '" "' + words[0] + '"' + antiFilters);
      queries.push('"' + words[0] + '" "' + bankWord + '" "konfirmasi"' + antiFilters);
    }
    queries.push('subject:"Konfirmasi" "' + words[0] + '"' + antiFilters);
    queries.push('subject:"Konfirmasi plafond" "' + words[0] + '"' + antiFilters);
  }

  // Tier 3: Body pencarian ketat
  queries.push('"' + cleanNameOnly + '" "done akad"' + antiFilters);
  if (words.length >= 2) {
    queries.push('"' + words[0] + '" "' + words[1] + '" "konfirmasi" "plafond"' + antiFilters);
    if (bankWord) {
      queries.push('"' + words[0] + '" "' + words[1] + '" "' + bankWord + '"' + antiFilters);
    }
  }

  var matchedThread = null;
  var queryUsed = '';
  var internalEmail = (Session.getActiveUser().getEmail() || 'dzaky.rayssa@99.co').toLowerCase();

  for (var i = 0; i < queries.length; i++) {
    var q = queries[i];
    try {
      var threads = GmailApp.search(q, 0, 5);
      for (var t = 0; t < threads.length; t++) {
        var th = threads[t];
        var firstSub = (th.getFirstMessageSubject() || '').toLowerCase();

        // 1. REJECT thread jika subjek berkaitan dengan SPA / Dropbox Sign / HelloSign
        if (firstSub.indexOf('spa') !== -1 ||
            firstSub.indexOf('hellosign') !== -1 ||
            firstSub.indexOf('dropbox sign') !== -1 ||
            firstSub.indexOf('signature') !== -1 ||
            firstSub.indexOf('tanda tangan') !== -1 ||
            firstSub.indexOf('has viewed') !== -1 ||
            firstSub.indexOf('viewed:') !== -1 ||
            firstSub.indexOf('completed:') !== -1 ||
            firstSub.indexOf('copied on') !== -1 ||
            firstSub.indexOf('perjanjian agen') !== -1) {
          continue;
        }

        var msgs = th.getMessages();
        var isSignatureThread = false;
        var hasBankOrExternalReply = false;
        var mentionsCust = false;

        for (var m = 0; m < msgs.length; m++) {
          var msg = msgs[m];
          var sender = (msg.getFrom() || '').toLowerCase();
          var sub = (msg.getSubject() || '').toLowerCase();
          var body = (msg.getPlainBody() || '').toLowerCase();

          // Reject jika pengirim berasal dari sistem tanda tangan digital
          if (sender.indexOf('hellosign.com') !== -1 || 
              sender.indexOf('dropboxsign.com') !== -1 || 
              sender.indexOf('docusign.net') !== -1 ||
              sender.indexOf('advertise@99.co') !== -1) {
            isSignatureThread = true;
            break;
          }

          // Cek apakah ada respon dari PIC Bank (email eksternal non-99.co) atau email forward dari PIC Bank
          if (sender.indexOf(internalEmail) === -1 && 
              sender.indexOf('@99.co') === -1 && 
              sender.indexOf('@rumah123.com') === -1) {
            hasBankOrExternalReply = true;
          } else if (body.indexOf('forwarded message') !== -1 || body.indexOf('pesan yang diteruskan') !== -1) {
            hasBankOrExternalReply = true;
          }

          // Verifikasi nasabah disebut dalam email secara spesifik
          var custLower = cleanNameOnly.toLowerCase();
          if (sub.indexOf(custLower) !== -1 || body.indexOf(custLower) !== -1) {
            mentionsCust = true;
          } else if (words.length >= 2) {
            var matchedWordCount = 0;
            for (var wIdx = 0; wIdx < words.length; wIdx++) {
              if (body.indexOf(words[wIdx].toLowerCase()) !== -1 || sub.indexOf(words[wIdx].toLowerCase()) !== -1) {
                matchedWordCount++;
              }
            }
            if (matchedWordCount >= 2) {
              mentionsCust = true;
            }
          } else if (words.length === 1) {
            if (body.indexOf(words[0].toLowerCase()) !== -1 || sub.indexOf(words[0].toLowerCase()) !== -1) {
              mentionsCust = true;
            }
          }
        }

        if (isSignatureThread) continue;

        // Subjek atau pesan wajib relevan dengan konfirmasi / plafond / akad
        var threadText = (firstSub + ' ' + (msgs[0] ? msgs[0].getPlainBody() : '')).toLowerCase();
        var isConfirmationTopic = threadText.indexOf('konfirmasi') !== -1 || 
                                  threadText.indexOf('plafond') !== -1 || 
                                  threadText.indexOf('akad') !== -1 ||
                                  threadText.indexOf('sp3k') !== -1 ||
                                  threadText.indexOf('offering letter') !== -1;

        // Validasi kesesuaian Bank
        if (bankWord) {
          var bwLower = bankWord.toLowerCase();
          var bankKeywords = ['danamon', 'cimb', 'mandiri', 'permata', 'uob', 'bsi', 'maybank', 'sinarmas', 'muamalat', 'bca', 'btn', 'bri', 'bni', 'hana'];
          var otherBanks = bankKeywords.filter(function(b) { return b !== bwLower; });
          var hasTargetBank = threadText.indexOf(bwLower) !== -1;
          var hasOtherBankOnly = otherBanks.some(function(b) { return threadText.indexOf(b) !== -1; }) && !hasTargetBank;
          if (hasOtherBankOnly) {
            continue;
          }
        }

        if (mentionsCust && isConfirmationTopic && (hasBankOrExternalReply || (customQuery && customQuery.trim()))) {
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
      message: 'Tidak ditemukan email konfirmasi bank di Gmail (atau belum ada balasan dari PIC Bank) untuk nasabah ' + customerName,
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

  html += '<table class="header-table"><tr>';
  html += '<td style="vertical-align: top;">';
  html += '<span class="logo-text">99</span><span class="logo-sub"> GROUP</span>';
  html += '</td>';
  html += '<td class="header-meta">';
  html += '<b>99.co Mail - ' + escapeHtml(threadSubject) + '</b><br/>';
  html += 'Dzaky Rayssa Buntoro &lt;' + escapeHtml(userEmail) + '&gt;';
  html += '</td></tr></table>';

  html += '<div class="subject-title">' + escapeHtml(threadSubject) + '</div>';
  html += '<div class="message-count">' + messages.length + ' messages</div>';
  html += '<hr class="main-divider" />';

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
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }
  var driveFile = targetFolder.createFile(pdfBlob);

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
