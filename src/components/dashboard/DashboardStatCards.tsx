import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { type CarouselApi, Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { StatCard } from "./StatCard";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { getCardConfig } from "@/constants/dashboardCards";
import { cn } from "@/lib/utils";

export function DashboardStatCards() {
  const navigate = useNavigate();
  const { cards: selectedCardIds } = useDashboardPreferences();
  const { data: stats = {} } = useDashboardStats(selectedCardIds);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
  }, [api]);

  const handleSetApi = useCallback(
    (newApi: CarouselApi) => {
      setApi(newApi);
      if (newApi) {
        newApi.on("select", onSelect);
      }
    },
    [onSelect]
  );

  const cards = selectedCardIds
    .map((cardId) => {
      const config = getCardConfig(cardId);
      if (!config) return null;
      const value =
        cardId === "revenue_this_month"
          ? `$${(stats[cardId] || 0).toLocaleString()}`
          : (stats[cardId] ?? 0);
      return { cardId, config, value };
    })
    .filter(Boolean) as { cardId: string; config: NonNullable<ReturnType<typeof getCardConfig>>; value: string | number }[];

  const totalDots = cards.length;

  return (
    <div>
      <div className="hidden sm:flex gap-3">
        {cards.map(({ cardId, config, value }) => (
          <StatCard
            key={cardId}
            label={config.label}
            value={value}
            icon={config.icon}
            onClick={() => navigate(config.navigateTo)}
          />
        ))}
      </div>

      <div className="sm:hidden -mx-4">
        <Carousel
          setApi={handleSetApi}
          opts={{ align: "start", loop: false }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 pl-4">
            {cards.map(({ cardId, config, value }) => (
              <CarouselItem key={cardId} className="basis-[45%] pl-2">
                <StatCard
                  label={config.label}
                  value={value}
                  icon={config.icon}
                  onClick={() => navigate(config.navigateTo)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {totalDots > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {cards.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  index === currentSlide
                    ? "w-4 bg-foreground/60"
                    : "w-1.5 bg-foreground/15"
                )}
                onClick={() => api?.scrollTo(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
