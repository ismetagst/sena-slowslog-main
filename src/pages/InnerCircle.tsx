import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    id: "yearly",
    name: "1 Year",
    price: "Rp. 99.000",
    period: "/year",
    description: "Support the platform for a year",
    benefits: [
      "Verified Circle Badge on your profile & stories",
      "Control who can read your writing with exclusive Inner Circle access",
      "Hide your blog or stories anytime you want",
      "Write consistently: once every three days",
      "Access deeper user analytics",
      "Export all your articles to PDF anytime as your personal backup",
      "Trash & recover deleted stories within 24 hours",
    ],
  },
  {
    id: "forever",
    name: "Lifetime",
    price: "Rp. 299.000",
    period: " one-time",
    description: "Lifetime access, forever grateful",
    popular: true,
    benefits: [
      "Verified Circle Badge on your profile & stories",
      "Control who can read your writing with exclusive Inner Circle access",
      "Hide your blog or stories anytime you want",
      "Write consistently: once every three days",
      "Access deeper user analytics",
      "Export all your articles to PDF anytime as your personal backup",
      "Trash & recover deleted stories within 24 hours",
    ],
  },
];

const InnerCircle = () => {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isInnerCircle = roles.includes("inner_circle");

  const { data: featureEnabled } = useQuery({
    queryKey: ["site-settings", "inner_circle_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "inner_circle_enabled")
        .single();
      return (data?.value as any)?.enabled ?? false;
    },
  });

  const { data: pendingOrder } = useQuery({
    queryKey: ["ic-order-pending", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ic_orders")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .maybeSingle();
      return data;
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate(`/inner-circle/payment?plan=${planId}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(45,80%,75%)] bg-[hsl(45,80%,95%)] px-4 py-1.5 text-sm font-medium text-[hsl(45,60%,35%)]">
            <BadgeCheck className="h-4 w-4 text-[hsl(45,90%,50%)] fill-[hsl(45,90%,50%)] stroke-white" />
            Inner Circle
          </div>

          <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            Support & Join Inner Circle
          </h1>
          <p className="mt-3 text-muted-foreground">
            Help us keep this space alive. Get verified and unlock exclusive features.
          </p>

          {isInnerCircle && (
            <div className="mt-6 rounded-lg border border-[hsl(140,50%,75%)] bg-[hsl(140,50%,95%)] p-4 text-sm text-[hsl(140,50%,30%)]">
              You're already an Inner Circle member! Thank you for your support (★‿★)
            </div>
          )}

          {pendingOrder && !isInnerCircle && (
            <div className="mt-6 rounded-lg border border-[hsl(45,80%,75%)] bg-[hsl(45,80%,95%)] p-4 text-sm text-[hsl(45,60%,35%)]">
              Your order is being reviewed. We'll notify you soon! (◕ᴗ◕✿)
            </div>
          )}

          {!featureEnabled && !isInnerCircle && (
            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
              Inner Circle is currently not available. Check back soon! (◕ᴗ◕✿)
            </div>
          )}

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 text-left transition-shadow hover:shadow-md ${
                  plan.popular
                    ? "border-[hsl(45,80%,65%)] bg-[hsl(45,80%,97%)]"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-[hsl(45,90%,50%)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    <Sparkles className="h-3 w-3" /> Best Value
                  </div>
                )}
                <h3 className="font-serif text-lg font-medium">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                <div className="mt-4">
                  <span className="font-serif text-3xl font-medium">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {plan.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[hsl(45,90%,50%)]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={!featureEnabled || isInnerCircle || !!pendingOrder}
                  className={`mt-6 w-full ${
                    plan.popular
                      ? "bg-[hsl(45,90%,50%)] text-white hover:bg-[hsl(45,90%,45%)]"
                      : ""
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {isInnerCircle
                    ? "Already a member"
                    : pendingOrder
                    ? "Order pending"
                    : !featureEnabled
                    ? "Coming Soon"
                    : "Select Plan"}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default InnerCircle;

