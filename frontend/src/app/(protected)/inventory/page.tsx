'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/shared/Pagination';
import { MobileCard, MobileCardList, MobileField, MobileFields } from '@/components/shared/MobileCard';
import { useInventory, useInventoryStores, useInventoryCategories } from '@/hooks/useInventory';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import type { InventoryRow } from '@/types/api';

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [store, setStore] = useState('all');
  const [category, setCategory] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data, isLoading, isError } = useInventory(page, 12, {
    store: store !== 'all' ? store : undefined,
    category: category !== 'all' ? category : undefined,
    lowStockOnly,
  });
  const { data: stores } = useInventoryStores();
  const { data: categories } = useInventoryCategories();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={store} onValueChange={(v) => { setStore(v ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores?.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox id="lowStock" checked={lowStockOnly} onCheckedChange={(c) => { setLowStockOnly(c === true); setPage(1); }} />
            <Label htmlFor="lowStock" className="text-sm font-normal">Low stock only</Label>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock Levels</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Failed to load inventory.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Purchased</TableHead>
                      <TableHead className="text-right">Consumed</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>As of</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.itemName}</TableCell>
                        <TableCell>{i.outletName}</TableCell>
                        <TableCell>{i.category ?? '—'}</TableCell>
                        <TableCell>{i.store ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.openingStock)}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.purchasedQty)}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.consumedQty)}</TableCell>
                        <TableCell className="text-right">{formatNumber(i.closingStock)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(i.stockValue)}</TableCell>
                        <TableCell>{formatDate(i.stockDate)}</TableCell>
                        <TableCell>
                          {i.isLowStock ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="secondary">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <MobileCardList>
                {data.rows.map((i) => (
                  <InventoryCard key={i.id} item={i} />
                ))}
              </MobileCardList>
              <Pagination meta={data.meta} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryCard({ item }: { item: InventoryRow }) {
  return (
    <MobileCard
      title={item.itemName}
      subtitle={item.outletName}
      aside={item.isLowStock ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="secondary">OK</Badge>}
    >
      <MobileFields>
        <MobileField label="Opening">{formatNumber(item.openingStock)}</MobileField>
        <MobileField label="Purchased">{formatNumber(item.purchasedQty)}</MobileField>
        <MobileField label="Consumed">{formatNumber(item.consumedQty)}</MobileField>
        <MobileField label="Closing">{formatNumber(item.closingStock)}</MobileField>
        <MobileField label="Value">{formatCurrency(item.stockValue)}</MobileField>
        <MobileField label="As of">{formatDate(item.stockDate)}</MobileField>
        <MobileField label="Category">{item.category ?? '—'}</MobileField>
        <MobileField label="Store">{item.store ?? '—'}</MobileField>
      </MobileFields>
    </MobileCard>
  );
}
