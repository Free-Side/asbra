param ($ChallengeResultsCsv)

function Generate-EventResults {
  param ([String]$EventName, [Object[]]$AthleteResults)

  $categories = $AthleteResults | Group-Object -Property "Category"

  foreach ($category in $categories) {
    $categoryDetails = @{ Name = $category.Name };
    $categoryDetails.Results = New-Object System.Collections.ArrayList;

    foreach ($athlete in $category.Group) {
      $points = [Int32](Select-Object -ExpandProperty "$($EventName) - Points" -InputObject $athlete)
      if ($points -gt 0) {
        $place = Select-Object -ExpandProperty "$($EventName) - Place" -InputObject $athlete -ErrorAction Ignore
        $time = Select-Object -ExpandProperty "$($EventName) - Time" -InputObject $athlete -ErrorAction Ignore

        $athleteDetail = @{
          Name = Select-Object -ExpandProperty "Athlete" -InputObject $athlete;
          Points = $points
        }

        if ($place -ne $null) {
          $athleteDetail.Place = [Int32]$place
        }
        if ($time -ne $null) {
          $athleteDetail.Time = $time
        }

        [void]$categoryDetails.Results.Add($athleteDetail)
      }
    }

    if ($categoryDetails.Results.Count -gt 0) {
      Write-Output $categoryDetails
    }
  }
}

$csvPath = Resolve-Path $ChallengeResultsCsv

$results = Import-Csv $csvPath

$events = @("Castle to Hanauma", "Mokuleia", "Pineapple Sprint", "Tantalus", "Malaekahana", "Pineapple Hill RR")
$eventDates = @([DateTime]"2021-03-06", [DateTime]"2021-03-20", [DateTime]"2021-03-27", [DateTime]"2021-04-17", [DateTime]"2021-05-01", [DateTime]"2021-06-12")

$data = @{}

$data.Overall = Generate-EventResults "Overall" $results
$data.Events = New-Object System.Collections.ArrayList

for ($i = 0; $i -lt $events.Length; $i++) {
  $event = $events[$i]
  $eventData = @{ Date = $eventDates[$i] }
  $eventData.Name = $event
  $eventData.Categories = Generate-EventResults $event $results

  [void]$data.Events.Add($eventData)
}

return $data
