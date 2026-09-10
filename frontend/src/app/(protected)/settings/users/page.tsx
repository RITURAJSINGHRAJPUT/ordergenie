'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/shared/Pagination';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useRoles } from '@/hooks/useSettings';
import { useOutlets } from '@/hooks/useOutlets';
import { usePagedList } from '@/hooks/usePagedList';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/format';
import type { UserRow } from '@/types/api';

// Radix Select can't use '' as an item value, so the "All" choices carry sentinels that are
// translated back to null (unrestricted) on submit.
const ALL_BRANDS = '__all_brands__';
const ALL_OUTLETS = '__all_outlets__';

export default function UsersPage() {
  const { data: users, isLoading, isError } = useUsers();
  const { data: roles } = useRoles();
  const { data: outlets } = useOutlets();
  const updateUser = useUpdateUser();
  const currentUserId = useAuthStore((s) => s.user)?.id;
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const { pageItems: usersPage, meta: usersMeta, setPage: setUsersPage } = usePagedList(users);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : isError || !users ? (
            <p className="text-sm text-destructive">Failed to load users.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersPage.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell>{u.brand ?? 'All brands'}</TableCell>
                      <TableCell>{u.outletName ?? 'All outlets'}</TableCell>
                      <TableCell>{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={(checked) => updateUser.mutate({ id: u.id, isActive: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => setEditing(u)}>
                            Edit
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              className="text-xs font-medium text-destructive hover:underline"
                              onClick={() => setDeleting(u)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination meta={usersMeta} onPageChange={setUsersPage} />
            </>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} roles={roles ?? []} outlets={outlets ?? []} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} roles={roles ?? []} outlets={outlets ?? []} />
      <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
  roles,
  outlets,
}: {
  open: boolean;
  onClose: () => void;
  roles: { id: string; name: string }[];
  outlets: { id: string; name: string; brand: string }[];
}) {
  const createUser = useCreateUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [brand, setBrand] = useState('');
  const [outletId, setOutletId] = useState<string>('');

  function reset() {
    setEmail('');
    setName('');
    setPassword('');
    setRoleId('');
    setBrand('');
    setOutletId('');
  }

  const brandOptions = [...new Set(outlets.map((o) => o.brand))].sort();
  const allBrands = brand === ALL_BRANDS;
  const filteredOutlets = allBrands ? outlets : outlets.filter((o) => o.brand === brand);
  const roleName = roles.find((r) => r.id === roleId)?.name;
  // These roles are scoped by a single outlet (scopeToOutlet), so "All" is not offered.
  const requiresOutlet = roleName === 'HEAD_CHEF' || roleName === 'OUTLET_MANAGER';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), reset())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={(v) => setRoleId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Brand{requiresOutlet ? ' (required for this role)' : ''}</Label>
            <Select
              value={brand}
              onValueChange={(v) => {
                setBrand(v ?? '');
                setOutletId('');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {!requiresOutlet && <SelectItem value={ALL_BRANDS}>All brands</SelectItem>}
                {brandOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assigned Outlet{requiresOutlet ? ' (required for this role)' : ''}</Label>
            <Select value={outletId} onValueChange={(v) => setOutletId(v ?? '')} disabled={!brand}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={brand ? 'Select outlet' : 'Pick a brand first'} />
              </SelectTrigger>
              <SelectContent>
                {!requiresOutlet && <SelectItem value={ALL_OUTLETS}>All outlets</SelectItem>}
                {filteredOutlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              !email ||
              !name ||
              !password ||
              !roleId ||
              (requiresOutlet && (!brand || !outletId)) ||
              createUser.isPending
            }
            onClick={() =>
              createUser.mutate(
                {
                  email,
                  name,
                  password,
                  roleId,
                  outletId: outletId && outletId !== ALL_OUTLETS ? outletId : undefined,
                  brand: allBrands || !brand ? null : brand,
                },
                {
                  onSuccess: () => {
                    onClose();
                    reset();
                  },
                }
              )
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onClose,
  roles,
  outlets,
}: {
  user: UserRow | null;
  onClose: () => void;
  roles: { id: string; name: string }[];
  outlets: { id: string; name: string; brand: string }[];
}) {
  const updateUser = useUpdateUser();
  const [roleId, setRoleId] = useState(user?.roleId ?? '');
  const [outletId, setOutletId] = useState(user?.outletId ?? '');
  const [brand, setBrand] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');

  const effectiveRoleId = roleId || user?.roleId || '';
  // A user with no outlet is unrestricted at outlet level, so the picker shows "All outlets".
  const effectiveOutletId = outletId || user?.outletId || (user ? ALL_OUTLETS : '');
  const currentOutletBrand = outlets.find((o) => o.id === (user?.outletId ?? ''))?.brand ?? '';
  const storedBrand = user?.brand ?? (user && !user.outletId ? ALL_BRANDS : '');
  const effectiveBrand = brand || currentOutletBrand || storedBrand;
  const allBrands = effectiveBrand === ALL_BRANDS;

  const brandOptions = [...new Set(outlets.map((o) => o.brand))].sort();
  const filteredOutlets = allBrands ? outlets : outlets.filter((o) => o.brand === effectiveBrand);
  const roleName = roles.find((r) => r.id === effectiveRoleId)?.name;
  // These roles are scoped by a single outlet (scopeToOutlet), so "All" is not offered.
  const requiresOutlet = roleName === 'HEAD_CHEF' || roleName === 'OUTLET_MANAGER';

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setPassword('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email || user?.email || ''} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={effectiveRoleId} onValueChange={(v) => setRoleId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Brand{requiresOutlet ? ' (required for this role)' : ''}</Label>
            <Select
              value={effectiveBrand}
              onValueChange={(v) => {
                setBrand(v ?? '');
                setOutletId('');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {!requiresOutlet && <SelectItem value={ALL_BRANDS}>All brands</SelectItem>}
                {brandOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assigned Outlet{requiresOutlet ? ' (required for this role)' : ''}</Label>
            <Select value={effectiveOutletId} onValueChange={(v) => setOutletId(v ?? '')} disabled={!effectiveBrand}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={effectiveBrand ? 'Select outlet' : 'Pick a brand first'} />
              </SelectTrigger>
              <SelectContent>
                {!requiresOutlet && <SelectItem value={ALL_OUTLETS}>All outlets</SelectItem>}
                {filteredOutlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reset Password</Label>
            <Input type="password" placeholder="Leave blank to keep current" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              updateUser.isPending ||
              (requiresOutlet && (!effectiveBrand || allBrands || !effectiveOutletId || effectiveOutletId === ALL_OUTLETS))
            }
            onClick={() => {
              if (!user) return;
              updateUser.mutate(
                {
                  id: user.id,
                  email: email || user.email,
                  roleId: effectiveRoleId,
                  outletId: effectiveOutletId && effectiveOutletId !== ALL_OUTLETS ? effectiveOutletId : null,
                  brand: allBrands || !effectiveBrand ? null : effectiveBrand,
                  ...(password ? { password } : {}),
                },
                { onSuccess: onClose }
              );
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const deleteUser = useDeleteUser();

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user?.name}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently deletes {user?.email}&apos;s account. This can&apos;t be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteUser.isPending}
            onClick={() => {
              if (!user) return;
              deleteUser.mutate(user.id, { onSuccess: onClose });
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
