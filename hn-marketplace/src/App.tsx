import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured, DEMO } from '@/lib/supabase';
import { DialogProvider } from '@/context/DialogContext';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { CallProvider } from '@/context/CallContext';
import { LangProvider } from '@/context/LangContext';
import { DashboardLayout, PublicLayout, RequireAuth, RouteTracker, Logo } from '@/components/Layout';
import { PageLoader } from '@/components/ui';
import { initAnalytics } from '@/lib/analytics';
import { SITE } from '@/lib/site';
import Home from '@/pages/public/Home';

const S = (name: keyof typeof import('@/pages/public/StaticPages')) => lazy(() => import('@/pages/public/StaticPages').then((m) => ({ default: m[name] as React.ComponentType })));
const About = S('About'); const HowItWorks = S('HowItWorks'); const Help = S('Help'); const Terms = S('Terms');
const Privacy = S('Privacy'); const RefundPolicy = S('RefundPolicy'); const NotFound = S('NotFound');
const AU = (name: keyof typeof import('@/pages/auth/Auth')) => lazy(() => import('@/pages/auth/Auth').then((m) => ({ default: m[name] as React.ComponentType })));
const Login = AU('Login'); const Register = AU('Register'); const ForgotPassword = AU('ForgotPassword'); const ResetPassword = AU('ResetPassword');
const T = (name: keyof typeof import('@/pages/public/Trust')) => lazy(() => import('@/pages/public/Trust').then((m) => ({ default: m[name] as React.ComponentType })));
const Pricing = T('Pricing'); const Guarantee = T('Guarantee'); const TrustSafety = T('TrustSafety');
const C = (name: keyof typeof import('@/pages/public/Content')) => lazy(() => import('@/pages/public/Content').then((m) => ({ default: m[name] as React.ComponentType })));
const Blog = C('Blog'); const BlogPostPage = C('BlogPostPage'); const CaseStudies = C('CaseStudies'); const ServicePage = C('ServicePage');
const ManagedProjects = C('ManagedProjects'); const Consultation = C('Consultation'); const Services = C('Services');
const J = (name: keyof typeof import('@/pages/public/Jobs')) => lazy(() => import('@/pages/public/Jobs').then((m) => ({ default: m[name] as React.ComponentType })));
const JobsBoard = J('JobsBoard'); const JobDetail = J('JobDetail'); const PostRequest = J('PostRequest');
const R = (name: keyof typeof import('@/pages/app/Requests')) => lazy(() => import('@/pages/app/Requests').then((m) => ({ default: m[name] as React.ComponentType })));
const MyRequests = R('MyRequests'); const RequestDetail = R('RequestDetail'); const MyProposals = R('MyProposals'); const GigAnalytics = R('GigAnalytics');

// Code-split everything behind the landing page
const Agency = lazy(() => import('@/pages/public/Agency'));
const Contact = lazy(() => import('@/pages/public/Contact'));
const Explore = lazy(() => import('@/pages/public/Explore'));
const Freelancers = lazy(() => import('@/pages/public/Explore').then((m) => ({ default: m.Freelancers })));
const GigDetail = lazy(() => import('@/pages/public/GigDetail'));
const FreelancerProfile = lazy(() => import('@/pages/public/FreelancerProfile'));
const Dashboard = lazy(() => import('@/pages/app/Dashboard'));
const Orders = lazy(() => import('@/pages/app/Orders'));
const OrderDetail = lazy(() => import('@/pages/app/OrderDetail'));
const Checkout = lazy(() => import('@/pages/app/Checkout'));
const Messages = lazy(() => import('@/pages/app/Messages'));
const Wallet = lazy(() => import('@/pages/app/Wallet'));
const Settings = lazy(() => import('@/pages/app/Settings'));
const Onboarding = lazy(() => import('@/pages/app/Settings').then((m) => ({ default: m.Onboarding })));
const MyGigs = lazy(() => import('@/pages/app/Gigs').then((m) => ({ default: m.MyGigs })));
const GigEditor = lazy(() => import('@/pages/app/Gigs').then((m) => ({ default: m.GigEditor })));
const Portfolio = lazy(() => import('@/pages/app/Gigs').then((m) => ({ default: m.Portfolio })));
const Notifications = lazy(() => import('@/pages/app/Misc').then((m) => ({ default: m.Notifications })));
const Saved = lazy(() => import('@/pages/app/Misc').then((m) => ({ default: m.Saved })));
const Payments = lazy(() => import('@/pages/app/Misc').then((m) => ({ default: m.Payments })));
const Reviews = lazy(() => import('@/pages/app/Misc').then((m) => ({ default: m.Reviews })));
const Support = lazy(() => import('@/pages/app/Misc').then((m) => ({ default: m.Support })));
const DemoBar = DEMO ? lazy(() => import('@/demo/DemoBar').then((m) => ({ default: m.DemoBar }))) : () => null;
// The live preview runs inside a sandboxed frame without real URLs, so it routes in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;
const A = (name: keyof typeof import('@/pages/admin/Admin')) => lazy(() => import('@/pages/admin/Admin').then((m) => ({ default: m[name] as React.ComponentType })));
const AdminOverview = A('AdminOverview');
const AdminUsers = A('AdminUsers');
const AdminGigs = A('AdminGigs');
const AdminCategories = A('AdminCategories');
const AdminOrders = A('AdminOrders');
const AdminPayments = A('AdminPayments');
const AdminWithdrawals = A('AdminWithdrawals');
const AdminDisputes = A('AdminDisputes');
const AdminReports = A('AdminReports');
const AdminLogs = A('AdminLogs');
const AdminSettings = A('AdminSettings');
const G = (name: keyof typeof import('@/pages/admin/AdminGrowth')) => lazy(() => import('@/pages/admin/AdminGrowth').then((m) => ({ default: m[name] as React.ComponentType })));
const AdminLeads = G('AdminLeads'); const AdminVerification = G('AdminVerification'); const AdminCoupons = G('AdminCoupons'); const AdminJobs = G('AdminJobs');

/** Shown to visitors if the site is deployed without its backend settings — friendly, no technical details.
    (Developers: the console explains what is missing.) */
function MaintenanceScreen() {
  useEffect(() => { console.warn('[HN] Backend not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and rebuild.'); }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white p-6 dark:from-navy-950 dark:to-navy-900">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-navy-700 dark:bg-navy-800">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 font-heading text-2xl font-semibold">We’ll be right back</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">We’re making a few improvements to the marketplace. Please check again in a little while.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a href={`https://wa.me/${SITE.whatsapp}`} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white">Message us on WhatsApp</a>
          <a href={`mailto:${SITE.email}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-medium dark:border-navy-700">Email us</a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => { initAnalytics(); }, []);
  if (!isConfigured) return <ThemeProvider><MemoryRouter><MaintenanceScreen /></MemoryRouter></ThemeProvider>;
  return (
    <ThemeProvider>
      <LangProvider>
      <ToastProvider>
        <AuthProvider>
          <CallProvider>
            <DialogProvider>
            <Router {...(DEMO ? { initialEntries: [(typeof window !== 'undefined' && window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/')] } : {})}>
              <RouteTracker />
              <Suspense fallback={<PageLoader />}>
                {DEMO && <DemoBar />}
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route index element={<Home />} />
                    <Route path="agency" element={<Agency />} />
                    <Route path="explore" element={<Explore />} />
                    <Route path="freelancers" element={<Freelancers />} />
                    <Route path="freelancers/:id" element={<FreelancerProfile />} />
                    <Route path="gigs/:id" element={<GigDetail />} />
                    <Route path="about" element={<About />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="how-it-works" element={<HowItWorks />} />
                    <Route path="help" element={<Help />} />
                    <Route path="terms" element={<Terms />} />
                    <Route path="privacy" element={<Privacy />} />
                    <Route path="refund-policy" element={<RefundPolicy />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="fees" element={<Navigate to="/pricing" replace />} />
                    <Route path="guarantee" element={<Guarantee />} />
                    <Route path="money-back-guarantee" element={<Navigate to="/guarantee" replace />} />
                    <Route path="trust-safety" element={<TrustSafety />} />
                    <Route path="case-studies" element={<CaseStudies />} />
                    <Route path="portfolio" element={<Navigate to="/case-studies" replace />} />
                    <Route path="blog" element={<Blog />} />
                    <Route path="blog/:slug" element={<BlogPostPage />} />
                    <Route path="services" element={<Services />} />
                    <Route path="services/:slug" element={<ServicePage />} />
                    <Route path="managed-projects" element={<ManagedProjects />} />
                    <Route path="book-consultation" element={<Consultation />} />
                    <Route path="jobs" element={<JobsBoard />} />
                    <Route path="jobs/:id" element={<JobDetail />} />
                    <Route path="post-request" element={<PostRequest />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />
                    <Route path="reset-password" element={<ResetPassword />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>

                  <Route path="app" element={<RequireAuth><DashboardLayout area="app" /></RequireAuth>}>
                    <Route index element={<Dashboard />} />
                    <Route path="onboarding" element={<Onboarding />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="orders/:id" element={<OrderDetail />} />
                    <Route path="requests" element={<RequireAuth roles={['client']}><MyRequests /></RequireAuth>} />
                    <Route path="requests/new" element={<Navigate to="/post-request" replace />} />
                    <Route path="requests/:id" element={<RequireAuth roles={['client']}><RequestDetail /></RequireAuth>} />
                    <Route path="proposals" element={<RequireAuth roles={['freelancer']}><MyProposals /></RequireAuth>} />
                    <Route path="analytics" element={<RequireAuth roles={['freelancer']}><GigAnalytics /></RequireAuth>} />
                    <Route path="checkout/:id" element={<RequireAuth roles={['client', 'freelancer']}><Checkout /></RequireAuth>} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="messages/:id" element={<Messages />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="saved" element={<Saved />} />
                    <Route path="payments" element={<Payments />} />
                    <Route path="reviews" element={<Reviews />} />
                    <Route path="support" element={<Support />} />
                    <Route path="gigs" element={<RequireAuth roles={['freelancer']}><MyGigs /></RequireAuth>} />
                    <Route path="gigs/new" element={<RequireAuth roles={['freelancer']}><GigEditor /></RequireAuth>} />
                    <Route path="gigs/:id/edit" element={<RequireAuth roles={['freelancer']}><GigEditor /></RequireAuth>} />
                    <Route path="portfolio" element={<RequireAuth roles={['freelancer']}><Portfolio /></RequireAuth>} />
                    <Route path="wallet" element={<RequireAuth roles={['freelancer']}><Wallet /></RequireAuth>} />
                  </Route>

                  {/* Admin routes: the UI guard is a convenience — every admin action is re-checked in Postgres */}
                  <Route path="admin" element={<RequireAuth roles={['admin']}><DashboardLayout area="admin" /></RequireAuth>}>
                    <Route index element={<AdminOverview />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="gigs" element={<AdminGigs />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="leads" element={<AdminLeads />} />
                    <Route path="verification" element={<AdminVerification />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="jobs" element={<AdminJobs />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="orders/:id" element={<OrderDetail admin />} />
                    <Route path="payments" element={<AdminPayments />} />
                    <Route path="withdrawals" element={<AdminWithdrawals />} />
                    <Route path="disputes" element={<AdminDisputes />} />
                    <Route path="reports" element={<AdminReports />} />
                    <Route path="logs" element={<AdminLogs />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Route>
                  <Route path="dashboard" element={<Navigate to="/app" replace />} />
                </Routes>
              </Suspense>
            </Router>
            </DialogProvider>
          </CallProvider>
        </AuthProvider>
      </ToastProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
