import { DecisionLog } from '../types';

const formatPrice = (value: number) => value.toFixed(value < 0.01 ? 8 : value < 1 ? 6 : 2);

export function exportLossLogsAsJson(logs: DecisionLog[]): void {
  const lossLogs = logs.filter((l) => l.realizedPnl < 0);
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(lossLogs, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `tefeci-zarar-loglari-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportLossLogsAsMarkdown(logs: DecisionLog[]): void {
  const lossLogs = logs.filter((l) => l.realizedPnl < 0);

  let md = `# TEFECİ OYUNU - DETAYLI ZARAR VE HATA ANALİZ RAPORU (AI PROMPT İÇİN)\n\n`;
  md += `**Rapor Tarihi:** ${new Date().toLocaleString('tr-TR')}\n`;
  md += `**Toplam İncelenen Zarar Eden İşlem Sayısı:** ${lossLogs.length}\n\n`;
  md += `> **Amaç:** Bu dosya kayıtlı zarar ve likidasyonları analiz için dışa aktarır. Şema v2 kayıtları girişteki kaynak kalitesi ve freshness alanlarını taşır; migrate edilmiş legacy kayıtların veri kaynağı doğrulanmış kabul edilmemelidir.\n\n`;
  md += `---\n\n`;

  if (lossLogs.length === 0) {
    md += `*Şu ana kadar kaydedilmiş zarar eden işlem bulunmuyor. Mıntıka şu an kârda veya işlemler henüz kapanmadı.*\n`;
  } else {
    lossLogs.forEach((log, index) => {
      const dateStr = new Date(log.timestamp).toLocaleTimeString('tr-TR');
      md += `### ${index + 1}. [${log.traderName}] ${log.symbol} (${log.side} ${log.leverage}x)\n\n`;
      md += `- **İşlem Zamanı:** ${dateStr}\n`;
      md += `- **Giriş Fiyatı:** ${formatPrice(log.entryPrice)} USDT\n`;
      md += `- **Çıkış Fiyatı:** ${formatPrice(log.exitPrice)} USDT\n`;
      md += `- **İzole Marjin:** ${log.margin.toFixed(2)} USDT\n`;
      md += `- **Gerçekleşen Zarar:** **${log.realizedPnl.toFixed(2)} USDT** (%${log.roePercent.toFixed(1)} ROE)\n`;
      md += `- **Kapanış Nedeni:** \`${log.exitReason}\`\n\n`;

      md += `#### Giriş Anındaki İndikatör Verileri (Piyasa Durumu):\n`;
      md += `- **RSI (14):** ${log.entryIndicators.rsi14}\n`;
      md += `- **EMA 20:** ${formatPrice(log.entryIndicators.ema20)} | **EMA 50:** ${formatPrice(log.entryIndicators.ema50)}\n`;
      md += `- **Bollinger Bantları:** Üst: ${formatPrice(log.entryIndicators.bbUpper)} / Orta: ${formatPrice(log.entryIndicators.bbMiddle)} / Alt: ${formatPrice(log.entryIndicators.bbLower)}\n`;
      md += `- **Emir Defteri Alış Oranı:** %${(log.entryIndicators.orderbookImbalance * 100).toFixed(1)} | **Yönlü Kalıcılık:** ${(log.entryIndicators.orderbookPersistence * 100).toFixed(0)}% (${log.entryIndicators.orderbookSampleCount} örnek)\n`;
      md += `- **Fonlama Oranı:** %${(log.entryIndicators.fundingRate * 100).toFixed(4)}\n`;
      md += `- **Gerçek 5dk OI Değişimi:** %${log.entryIndicators.oiDelta5mPercent.toFixed(3)} (${Math.round(log.entryIndicators.oiHistorySpanMs / 1000)} sn pencere)\n`;
      md += `- **CVD Alıcı Payı:** %${(log.entryIndicators.cvdRatio * 100).toFixed(1)} (${log.entryIndicators.aggTradeCount5m} aggTrade)\n`;
      md += `- **Fitil/Gölge Oranı:** ${log.entryIndicators.spikeShadowRatio.toFixed(2)}x\n`;
      md += `- **1 Dakikalık Hacim Artışı:** ${log.entryIndicators.volumeSurgeRatio.toFixed(2)}x\n`;
      md += `- **Veri Kalitesi:** ${log.entryIndicators.dataQuality}; mum örneği: ${log.entryIndicators.klineSampleCount}\n\n`;

      md += `#### Pozisyon Açılış Gerekçesi:\n`;
      md += `> "${log.whyOpened}"\n\n`;

      md += `#### Neden Zarar Etti (Teşhis):\n`;
      md += `${log.whyFailedOrWon}\n\n`;

      md += `#### Yapay Zeka İçin İyileştirme Önerisi:\n`;
      md += `${log.aiImprovementNote}\n\n`;

      md += `---\n\n`;
    });
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', `tefeci-zarar-analizi-${new Date().toISOString().slice(0, 10)}.md`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}
