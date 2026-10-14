'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';
import { landingPathFor } from '@/components/layout/nav-items';
import { loginSchema, type LoginInput } from '@/schemas/login.schema';
import type { ApiEnvelope, LoginResponse } from '@/types/api';

export default function LoginPage() {
  const router = useRouter();
  const { token, user, isHydrated, login: setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isHydrated && token) {
      router.replace(landingPathFor(user?.role));
    }
  }, [isHydrated, token, user?.role, router]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const mutation = useMutation({
    mutationFn: async (values: LoginInput) => {
      const res = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/login', values);
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      // Not every role may open the Dashboard — a prep kitchen login would be bounced straight
      // back out of it by the protected layout's guard.
      router.replace(landingPathFor(data.user.role));
    },
    onError: () => {
      toast.error('Invalid email or password');
    },
  });

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back! 👋</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue to your OrderGenie account</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              className="h-10 pl-9"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-10 pl-9 pr-9"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              // right-1 + p-2 keeps the icon where right-3 put it, with a finger-sized hit area around it.
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="rememberMe"
            checked={watch('rememberMe')}
            onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
          />
          <Label htmlFor="rememberMe" className="text-sm font-normal">
            Remember me
          </Label>
        </div>

        <Button
          type="submit"
          className="h-10 w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Signing in...' : 'Sign in'}
          {!mutation.isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account, or forgot your password?{' '}
        <span className="font-medium text-foreground">Contact your administrator.</span>
      </p>
    </div>
  );
}
