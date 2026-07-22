// Azure Storage Queues cap a message body at 65536 bytes, and the Functions storage
// queue binding base64-encodes the body before sending, which inflates size by ~4/3.
// Budget for the pre-encoded JSON accordingly, with headroom for whatever envelope
// (retry metadata, correlation ids, etc.) the caller wraps each page in.
export const AZURE_QUEUE_MESSAGE_LIMIT_BYTES = 65536;
const PAGE_BYTE_BUDGET = Math.floor((AZURE_QUEUE_MESSAGE_LIMIT_BYTES * 3) / 4) - 1024;

/**
 * Chunks an array into pages that stay within the Azure Storage Queue byte budget,
 * optionally also capping each page at maxPageSize items. Always places at least one
 * item per page, even if that item alone exceeds the byte budget.
 */
export function pageByByteBudget<T>(items: T[], maxPageSize?: number): T[][] {
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let currentPageBytes = 0;

  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item));
    const wouldExceedByteBudget = currentPageBytes + itemBytes > PAGE_BYTE_BUDGET;
    const wouldExceedCountLimit = maxPageSize !== undefined && currentPage.length >= maxPageSize;

    if (currentPage.length > 0 && (wouldExceedByteBudget || wouldExceedCountLimit)) {
      pages.push(currentPage);
      currentPage = [];
      currentPageBytes = 0;
    }

    currentPage.push(item);
    currentPageBytes += itemBytes;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}
