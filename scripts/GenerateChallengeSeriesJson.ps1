using namespace Newtonsoft.Json

param ($ChallengeResultsCsv)

[JsonObject()]
class AthleteResult {
  [JsonProperty(Order = 4)][String]$Name
  [JsonProperty(Order = 3, NullValueHandling = [NullValueHandling]::Ignore)][Nullable[Int32]]$Place
  [JsonProperty(Order = 2)][Int32]$Points
  [JsonProperty(Order = 1, NullValueHandling = [NullValueHandling]::Ignore)][String]$Time

  AthleteResult([String]$AthleteName, [Int32]$ResultPoints, [Nullable[Int32]]$ResultPlace, [String]$ResultTime) {
    $this.Name = $AthleteName;
    $this.Place = $ResultPlace;
    $this.Points = $ResultPoints;
    if (-not [String]::IsNullOrEmpty($ResultTime)) {
      $this.Time = $ResultTime
    }
  }
}

[JsonObject()]
class CategoryResults {
  [JsonProperty(Order = 2)][String]$Name
  [JsonProperty(Order = 1)][AthleteResult[]]$Results

  CategoryResults([String]$CategoryName, [AthleteResult[]]$CategoryResults) {
    $this.Name = $CategoryName
    $this.Results = $CategoryResults
  }
}

[JsonObject()]
class EventResults {
  [JsonProperty(Order = 1)][String]$Name
  [JsonProperty(Order = 2, NullValueHandling = [NullValueHandling]::Ignore)][DateTime]$Date
  [JsonProperty(Order = 3)][CategoryResults[]]$Categories

  EventResults($EventName, $EventDate, $CategoryResults) {
    $this.Name = $EventName
    $this.Date = $EventDate
    $this.Categories = $CategoryResults
  }
}

[JsonObject()]
class SeriesResult {
  [JsonProperty(Order = 3)][String]$Name
  [JsonProperty(Order = 2)][Int32]$Place
  [JsonProperty(Order = 1)][Int32]$Points

  SeriesResult([String]$AthleteName, [Int32]$OverallPlace, [Int32]$OverallPoints) {
    $this.Name = $AthleteName
    $this.Place = $OverallPlace
    $this.Points = $OverallPoints
  }
}

[JsonObject()]
class Series {
  [CategoryResults[]]$Overall
  [EventResults[]]$Events

  Series([CategoryResults[]]$OverallResults, [EventResults[]]$Events) {
    $this.Overall = $OverallResults
    $this.Events = $Events
  }
}

function Generate-EventResults {
  param ([String]$EventName, [Object[]]$AthleteResults)

  $categories = $AthleteResults | Group-Object -Property "Category"

  foreach ($category in $categories) {
    $categoryResults = New-Object System.Collections.ArrayList;

    foreach ($athlete in $category.Group) {
      $points = [Int32](Select-Object -ExpandProperty "$($EventName) - Points" -InputObject $athlete)
      if ($points -gt 0) {
        $place = Select-Object -ExpandProperty "$($EventName) - Place" -InputObject $athlete -ErrorAction Ignore
        $time = Select-Object -ExpandProperty "$($EventName) - Time" -InputObject $athlete -ErrorAction Ignore

        $athleteDetail = [AthleteResult]::new(
          (Select-Object -ExpandProperty "Athlete" -InputObject $athlete),
          $points,
          $(if ($place -ne $null) { [Int32]$place } else { $null }),
          $time
        )

        [void]$categoryResults.Add($athleteDetail)
      }
    }

    if ($categoryResults.Count -gt 0) {
      Write-Output $([CategoryResults]::new($category.Name, ($categoryResults | Sort-Object -Property Place, Time)))
    }
  }
}

$csvPath = Resolve-Path $ChallengeResultsCsv

$results = Import-Csv $csvPath

$events = @("Castle to Hanauma", "Mokuleia", "Pineapple Sprint", "Tantalus", "Malaekahana", "Pineapple Hill RR", "DEMRR")
$eventDates = @([DateTime]"2021-03-06", [DateTime]"2021-03-20", [DateTime]"2021-03-27", [DateTime]"2021-04-17", [DateTime]"2021-05-01", [DateTime]"2021-06-12", [DateTime]"2021-08-29")

$overall = Generate-EventResults "Overall" $results
$eventObjects = New-Object System.Collections.ArrayList

for ($i = 0; $i -lt $events.Length; $i++) {
  $event = $events[$i]
  $eventResults = [EventResults]::new($event, $eventDates[$i], $(Generate-EventResults $event $results))

  [void]$eventObjects.Add($eventResults)
}

return [Series]::new($overall, $eventObjects)
