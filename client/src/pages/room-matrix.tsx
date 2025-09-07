import { useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import RoomGrid from "../components/room-matrix/room-grid";
import { Filter } from "lucide-react";

export default function RoomMatrix() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");

  return (
    <div className="space-y-6" data-testid="page-room-matrix">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-page-title">
          74-Unit Room Matrix
        </h2>
        <p className="text-muted-foreground">
          Interactive room status overview with real-time payment tracking.
        </p>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <Input
                type="text"
                placeholder="Search room number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-rooms"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="vacant">Vacant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-48" data-testid="select-floor-filter">
                <SelectValue placeholder="All Floors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                <SelectItem value="0">Ground Floor</SelectItem>
                <SelectItem value="1">1st Floor</SelectItem>
                <SelectItem value="2">2nd Floor</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-apply-filters">
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-foreground">Paid - Rent collected</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-foreground">Pending - Due soon</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-foreground">Overdue - Payment late</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-400 rounded"></div>
              <span className="text-sm text-foreground">Vacant - Available for rent</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Grid */}
      <Card>
        <CardHeader>
          <CardTitle>State House Block D - 74 Units</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomGrid 
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            floorFilter={floorFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
