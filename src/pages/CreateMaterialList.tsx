import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layers,
  Square,
  Leaf,
  Grid3X3,
  Fence,
  ChevronRight,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TemplateType } from "@/types/materials";

// Demo jobs
const availableJobs = [
  { id: "job-1", name: "Johnson Patio Installation", address: "1234 Oak Street" },
  { id: "job-2", name: "Williams Pool Deck", address: "890 Pine Road" },
  { id: "job-3", name: "Garcia Deck Build", address: "234 Cedar Lane" },
  { id: "job-4", name: "Martinez Backyard", address: "567 Elm Street" },
];

const templates: { id: TemplateType; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "pavers", label: "Pavers/Patio", icon: <Layers className="h-6 w-6" />, description: "Paver patios, walkways, driveways" },
  { id: "concrete", label: "Concrete", icon: <Square className="h-6 w-6" />, description: "Flatwork, slabs, foundations" },
  { id: "sod", label: "Sod/Lawn", icon: <Leaf className="h-6 w-6" />, description: "Lawn installation, grading" },
  { id: "decks", label: "Decks", icon: <Grid3X3 className="h-6 w-6" />, description: "Wood or composite decking" },
  { id: "fencing", label: "Fencing", icon: <Fence className="h-6 w-6" />, description: "Privacy, picket, chain link" },
];

type Step = "job" | "template" | "measurements" | "review";

export default function CreateMaterialList() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("job");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [wastageFactor, setWastageFactor] = useState(10);
  const [measurements, setMeasurements] = useState<Record<string, number | string | boolean>>({});

  const selectedJobData = availableJobs.find(j => j.id === selectedJob);

  const handleJobSelect = (jobId: string) => {
    setSelectedJob(jobId);
    setStep("template");
  };

  const handleTemplateSelect = (template: TemplateType) => {
    setSelectedTemplate(template);
    // Initialize measurements based on template
    const defaultMeasurements: Record<string, number | string | boolean> = {};
    if (template === "pavers") {
      defaultMeasurements.totalSqFt = 0;
      defaultMeasurements.paverType = "";
      defaultMeasurements.baseDepth = 6;
      defaultMeasurements.edgingLength = 0;
      defaultMeasurements.jointSandType = "Polymeric";
    } else if (template === "concrete") {
      defaultMeasurements.totalSqFt = 0;
      defaultMeasurements.thickness = 4;
      defaultMeasurements.useRebar = false;
      defaultMeasurements.useMesh = true;
      defaultMeasurements.controlJoints = 0;
      defaultMeasurements.useFiberAdditive = false;
    } else if (template === "sod") {
      defaultMeasurements.totalSqFt = 0;
      defaultMeasurements.topsoilDepth = 2;
      defaultMeasurements.useSeed = false;
      defaultMeasurements.useFertilizer = true;
      defaultMeasurements.edgingOption = "None";
    } else if (template === "decks") {
      defaultMeasurements.deckLength = 0;
      defaultMeasurements.deckWidth = 0;
      defaultMeasurements.joistSpacing = 16;
      defaultMeasurements.boardType = "Composite";
      defaultMeasurements.footingCount = 0;
      defaultMeasurements.hardwareType = "Standard";
    } else if (template === "fencing") {
      defaultMeasurements.linearFeet = 0;
      defaultMeasurements.fenceType = "Privacy";
      defaultMeasurements.postSpacing = 8;
      defaultMeasurements.gateCount = 1;
      defaultMeasurements.hardwareType = "Standard";
    }
    setMeasurements(defaultMeasurements);
    setStep("measurements");
  };

  const updateMeasurement = (key: string, value: number | string | boolean) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerateList = () => {
    setStep("review");
    // In production, this would calculate materials based on measurements
    setTimeout(() => {
      navigate("/materials/lists/ml-new");
    }, 1500);
  };

  const renderMeasurementInputs = () => {
    if (!selectedTemplate) return null;

    return (
      <div className="space-y-4">
        {selectedTemplate === "pavers" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="totalSqFt">Total Square Feet</Label>
              <Input
                id="totalSqFt"
                type="number"
                value={measurements.totalSqFt as number || ""}
                onChange={(e) => updateMeasurement("totalSqFt", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paverType">Paver Type/Size</Label>
              <Input
                id="paverType"
                value={measurements.paverType as string || ""}
                onChange={(e) => updateMeasurement("paverType", e.target.value)}
                placeholder="e.g., Cambridge Cobble 6x9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseDepth">Base Depth (inches)</Label>
              <Input
                id="baseDepth"
                type="number"
                value={measurements.baseDepth as number || ""}
                onChange={(e) => updateMeasurement("baseDepth", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edgingLength">Edging Length (feet)</Label>
              <Input
                id="edgingLength"
                type="number"
                value={measurements.edgingLength as number || ""}
                onChange={(e) => updateMeasurement("edgingLength", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jointSandType">Joint Sand Type</Label>
              <Input
                id="jointSandType"
                value={measurements.jointSandType as string || ""}
                onChange={(e) => updateMeasurement("jointSandType", e.target.value)}
                placeholder="e.g., Polymeric"
              />
            </div>
          </>
        )}

        {selectedTemplate === "concrete" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="totalSqFt">Total Square Feet</Label>
              <Input
                id="totalSqFt"
                type="number"
                value={measurements.totalSqFt as number || ""}
                onChange={(e) => updateMeasurement("totalSqFt", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thickness">Thickness (inches)</Label>
              <Input
                id="thickness"
                type="number"
                value={measurements.thickness as number || ""}
                onChange={(e) => updateMeasurement("thickness", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 4"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="useRebar">Use Rebar</Label>
              <Switch
                id="useRebar"
                checked={measurements.useRebar as boolean || false}
                onCheckedChange={(checked) => updateMeasurement("useRebar", checked)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="useMesh">Use Wire Mesh</Label>
              <Switch
                id="useMesh"
                checked={measurements.useMesh as boolean || false}
                onCheckedChange={(checked) => updateMeasurement("useMesh", checked)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="useFiberAdditive">Fiber Additive</Label>
              <Switch
                id="useFiberAdditive"
                checked={measurements.useFiberAdditive as boolean || false}
                onCheckedChange={(checked) => updateMeasurement("useFiberAdditive", checked)}
              />
            </div>
          </>
        )}

        {selectedTemplate === "decks" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deckLength">Length (feet)</Label>
                <Input
                  id="deckLength"
                  type="number"
                  value={measurements.deckLength as number || ""}
                  onChange={(e) => updateMeasurement("deckLength", parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deckWidth">Width (feet)</Label>
                <Input
                  id="deckWidth"
                  type="number"
                  value={measurements.deckWidth as number || ""}
                  onChange={(e) => updateMeasurement("deckWidth", parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 16"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="joistSpacing">Joist Spacing (inches)</Label>
              <Input
                id="joistSpacing"
                type="number"
                value={measurements.joistSpacing as number || ""}
                onChange={(e) => updateMeasurement("joistSpacing", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 16"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="boardType">Board Type</Label>
              <Input
                id="boardType"
                value={measurements.boardType as string || ""}
                onChange={(e) => updateMeasurement("boardType", e.target.value)}
                placeholder="e.g., Composite, Pressure Treated"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="footingCount">Number of Footings</Label>
              <Input
                id="footingCount"
                type="number"
                value={measurements.footingCount as number || ""}
                onChange={(e) => updateMeasurement("footingCount", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 12"
              />
            </div>
          </>
        )}

        {selectedTemplate === "fencing" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="linearFeet">Linear Feet</Label>
              <Input
                id="linearFeet"
                type="number"
                value={measurements.linearFeet as number || ""}
                onChange={(e) => updateMeasurement("linearFeet", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fenceType">Fence Type</Label>
              <Input
                id="fenceType"
                value={measurements.fenceType as string || ""}
                onChange={(e) => updateMeasurement("fenceType", e.target.value)}
                placeholder="e.g., Privacy, Picket"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postSpacing">Post Spacing (feet)</Label>
              <Input
                id="postSpacing"
                type="number"
                value={measurements.postSpacing as number || ""}
                onChange={(e) => updateMeasurement("postSpacing", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 8"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateCount">Number of Gates</Label>
              <Input
                id="gateCount"
                type="number"
                value={measurements.gateCount as number || ""}
                onChange={(e) => updateMeasurement("gateCount", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 1"
              />
            </div>
          </>
        )}

        {selectedTemplate === "sod" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="totalSqFt">Total Square Feet</Label>
              <Input
                id="totalSqFt"
                type="number"
                value={measurements.totalSqFt as number || ""}
                onChange={(e) => updateMeasurement("totalSqFt", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topsoilDepth">Topsoil Depth (inches)</Label>
              <Input
                id="topsoilDepth"
                type="number"
                value={measurements.topsoilDepth as number || ""}
                onChange={(e) => updateMeasurement("topsoilDepth", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 2"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="useSeed">Include Seed</Label>
              <Switch
                id="useSeed"
                checked={measurements.useSeed as boolean || false}
                onCheckedChange={(checked) => updateMeasurement("useSeed", checked)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="useFertilizer">Include Fertilizer</Label>
              <Switch
                id="useFertilizer"
                checked={measurements.useFertilizer as boolean || false}
                onCheckedChange={(checked) => updateMeasurement("useFertilizer", checked)}
              />
            </div>
          </>
        )}

        {/* Wastage Factor - common to all */}
        <div className="pt-4 border-t border-border">
          <div className="space-y-2">
            <Label htmlFor="wastage">Wastage Factor (%)</Label>
            <Input
              id="wastage"
              type="number"
              value={wastageFactor}
              onChange={(e) => setWastageFactor(parseFloat(e.target.value) || 10)}
              placeholder="e.g., 10"
            />
            <p className="text-2xs text-muted-foreground">
              Adds extra material to account for cuts and waste
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Create Material List" showBack />

      <main className="px-4 py-4">
        {/* Step 1: Select Job */}
        {step === "job" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Select Job</h2>
              <p className="text-sm text-muted-foreground">Choose the job for this material list</p>
            </div>

            <div className="space-y-3">
              {availableJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleJobSelect(job.id)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{job.name}</h3>
                      <p className="text-sm text-muted-foreground">{job.address}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Template */}
        {step === "template" && selectedJobData && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Select Template</h2>
              <p className="text-sm text-muted-foreground">{selectedJobData.name}</p>
            </div>

            <div className="space-y-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-secondary">
                      {template.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{template.label}</h3>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>

            <Button variant="outline" className="w-full" onClick={() => setStep("job")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 3: Measurements */}
        {step === "measurements" && selectedJobData && selectedTemplate && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {templates.find(t => t.id === selectedTemplate)?.label} Measurements
              </h2>
              <p className="text-sm text-muted-foreground">{selectedJobData.name}</p>
            </div>

            {renderMeasurementInputs()}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep("template")}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleGenerateList}>
                Generate List
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review/Loading */}
        {step === "review" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="p-4 rounded-full bg-[hsl(var(--status-confirmed-bg))] mb-4 animate-pulse">
              <Check className="h-12 w-12 text-[hsl(var(--status-confirmed))]" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Generating Materials</h2>
            <p className="text-muted-foreground">
              Calculating quantities with {wastageFactor}% wastage...
            </p>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
