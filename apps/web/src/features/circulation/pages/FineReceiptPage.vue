<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import type { FineReceiptDto } from '@thu-vien/shared';
import { ApiError } from '@/shared/api/client';
import * as circApi from '../api';

const route = useRoute();
const receipt = ref<FineReceiptDto | null>(null);
const loading = ref(true);
const error = ref('');
const isReaderReceipt = route.name === 'my-fine-receipt';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' });
}

function printReceipt(): void {
  window.print();
}

onMounted(async () => {
  try {
    const paymentId = String(route.params.id);
    receipt.value = isReaderReceipt
      ? await circApi.getMyFineReceipt(paymentId)
      : await circApi.getFineReceipt(paymentId);
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 404
      ? 'Không tìm thấy biên nhận hoặc bạn không có quyền xem.'
      : 'Không tải được biên nhận. Vui lòng thử lại.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="fine-receipt" aria-labelledby="receipt-title">
    <p v-if="loading" class="empty-state" role="status">Đang tải biên nhận…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="receipt">
      <div class="fine-receipt__actions no-print">
        <RouterLink :to="isReaderReceipt ? '/me/fines' : '/circulation/fines'">← Quay lại khoản phạt</RouterLink>
        <button type="button" @click="printReceipt">In biên nhận</button>
      </div>
      <article class="fine-receipt__paper">
        <header>
          <img src="/img/utc-logo.png" alt="" width="84" height="56" />
          <div><p>TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI</p><strong>THƯ VIỆN</strong></div>
        </header>
        <div class="fine-receipt__title">
          <p class="eyebrow">Xác nhận giao dịch</p>
          <h1 id="receipt-title">Biên nhận thu khoản phạt</h1>
          <strong>{{ receipt.receiptNumber }}</strong>
        </div>
        <dl class="fine-receipt__details">
          <div><dt>Người nộp</dt><dd>{{ receipt.borrowerName }}</dd></div>
          <div><dt>Người thu</dt><dd>{{ receipt.collectorName }}</dd></div>
          <div><dt>Thời gian</dt><dd>{{ formatDate(receipt.receivedAt) }}</dd></div>
          <div><dt>Tài liệu</dt><dd>{{ receipt.workTitle }}</dd></div>
          <div><dt>Mã bản sao</dt><dd>{{ receipt.copyCode }}</dd></div>
        </dl>
        <div class="fine-receipt__amount"><span>Số tiền đã nhận</span><strong>{{ receipt.amount.toLocaleString('vi-VN') }} ₫</strong></div>
        <p class="fine-receipt__balance">Số còn phải thu sau giao dịch: <strong>{{ receipt.remainingAfter.toLocaleString('vi-VN') }} ₫</strong></p>
        <footer>Biên nhận được lưu trong hệ thống thư viện. Vui lòng giữ mã biên nhận để đối chiếu.</footer>
      </article>
    </template>
  </section>
</template>

<style scoped>
.fine-receipt { max-width: 760px; margin: 0 auto; }
.fine-receipt__actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 20px; }
.fine-receipt__actions a { font-size: .83rem; font-weight: 600; text-decoration: none; }
.fine-receipt__paper { padding: clamp(22px, 5vw, 48px); background: #fff; border: 1px solid var(--line); border-radius: 12px; }
.fine-receipt__paper header { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.fine-receipt__paper header img { object-fit: contain; }
.fine-receipt__paper header p, .fine-receipt__paper header strong { margin: 0; color: var(--navy-deep); font-size: .78rem; font-weight: 700; letter-spacing: .04em; }
.fine-receipt__paper header strong { display: block; margin-top: 4px; font-size: .9rem; }
.fine-receipt__title { margin: 25px 0; text-align: center; }
.fine-receipt__title h1 { margin: 6px 0; }
.fine-receipt__title > strong { color: #7b652b; letter-spacing: .12em; }
.fine-receipt__details { display: grid; gap: 12px; }
.fine-receipt__details div { display: grid; grid-template-columns: minmax(130px, .55fr) 1.5fr; gap: 16px; padding-bottom: 10px; border-bottom: 1px dashed var(--line); }
.fine-receipt__details dt { color: var(--muted); font-size: .8rem; }
.fine-receipt__details dd { margin: 0; color: var(--ink); font-size: .84rem; font-weight: 600; }
.fine-receipt__amount { display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-top: 22px; padding: 16px; color: var(--navy-deep); background: #f6f8fc; border-left: 4px solid var(--gold); }
.fine-receipt__amount strong { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
.fine-receipt__balance { margin: 12px 0; text-align: right; font-size: .82rem; }
.fine-receipt__paper footer { margin-top: 28px; padding-top: 14px; color: var(--muted); border-top: 1px solid var(--line); font-size: .74rem; text-align: center; }
@media print { .no-print { display: none !important; } .fine-receipt__paper { border: 0; box-shadow: none; } }
</style>
