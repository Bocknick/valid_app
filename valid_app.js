//supabase.createCline connects to the supabase server
const supa_client = supabase.createClient(
      'https://hqbrjoqmadigbeteekmc.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYnJqb3FtYWRpZ2JldGVla21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjEyMTgsImV4cCI6MjA2NTM5NzIxOH0.6k1qFWdz8SL5UbFMX44oVHmjIMmpiZIl6k351FXXzGg'
);

const container = document.getElementById('app-container');
container.innerHTML =
    `<div class = "app-container">
        <div class = "dropdown" id = "params">
            <button>Parameters</button>
            <div class = "content" id = "param_content">
                <a>Biogeochemical</a>
                <a>BGC Derived</a>
                <a>Bio-optical</a>
            </div>
        </div>
        <div class = "dropdown" id = "plot_type">
            <button>Plot Type</button>
            <div class = "content">
                <a>Scatter Plot</a>
                <a>Profiles</a>
                <a>Anomaly Profiles</a>
                <a>Map</a>
            </div>
        </div>
        <form id = 'wmo_form' autocomplete="off" style = "width:250px; display:flex; gap: 4px;">
            <div class="autocomplete" style="flex: 2;">
                <input id="wmo_input" type="text" placeholder="WMO" style = "width: 100%;">
            </div>
            <input type="submit" value = "Submit" style = "flex: 1; margin-bottom: 5px;">
        </form>
        <a href = "https://www.go-bgc.org/wp-content/uploads/2024/11/Float_vs_Bottle_Table.txt" class = "file_link_button">Download Data</a>
        <a href = "https://www.go-bgc.org/wp-content/uploads/2024/11/README_FLOATvsBOTTLE.txt" class = "file_link_button">Readme</a><br>
        <div style="margin: 8px 0;">
            <input type="checkbox" id="goship_checkbox">
            <label for="goship_checkbox">GO-SHIP only</label>
        </div>
        <div id="plot_content" style="width:600px;height:300px;"></div>
    </div>`

let wmo_list;
let input_wmos;

const dropdown_options = document.getElementById('param_content')
let input_param = "Biogeochemical"
let goShip_only = false;
let input_plot_type = "Scatter Plot"
//Run metadata retriever; generate initial wmo_list and 
//run wrapper with all wmos

metadata_retriever(goShip_only).then(result => {
  wmo_list = result.map(row => row['WMO']);
  autocomplete(document.getElementById("wmo_input"), wmo_list);

  input_wmos = wmo_list;
  //Run wrapper for the first time using default input_param
  //and input_plot_type to load initial plot view
  wrapper(input_param, input_plot_type, input_wmos,goShip_only)
})

//Grab HTML elements for listeners
const param_content = document.getElementById('param_content');
const plot_type_content = document.getElementById("plot_type");
const go_ship = document.getElementById("goship_checkbox")

//Get the wmo_form <form> object and add a listener to the submit <input> object
document.getElementById('wmo_form').addEventListener('submit', function(event) {
    //The browser will reload the page by default when a form is submitted. 
    //preventDefault() prevents this behavior.
    event.preventDefault();
    input_wmos = [Number(document.getElementById('wmo_input').value)];
    if(Number(document.getElementById('wmo_input').value)==0){
      input_wmos = wmo_list;
    }
    //Run wrapper with selected wmos
    wrapper(parameter = input_param,plot_type = input_plot_type,selected_wmo=input_wmos,goShip_only)
});

//listen for a click on param_content
go_ship.addEventListener("change",function(event){
    if (go_ship.checked) {
        goShip_only=true;
    } else {
        goShip_only=false;
    }
  wrapper(input_param, input_plot_type, input_wmos,goShip_only)
})

//listen for a click on param_content
param_content.addEventListener("click",function(event){
  if(event.target.tagName == "A"){
    input_param = event.target.textContent
  }
  wrapper(input_param, input_plot_type, input_wmos,goShip_only)
})

//Listen for plot_type selections
plot_type_content.addEventListener("click",function(event){
  if(event.target.tagName == "A"){
    input_plot_type = event.target.textContent
  }
  //If user selects map, update dropdown options and set
  //input_param to Nitrate  
  if(input_plot_type == "Map"){
    dropdown_options.innerHTML = 
      `<a>Nitrate</a>
      <a>pH</a>
      <a>Oxygen</a>
      <a>DIC</a>
      <a>pCO2</a>
      <a>Alkalinity</a>
      <a>Chlorophyll</a>
      <a>Location</a>`
    input_param = "Nitrate"
  } else{
    dropdown_options.innerHTML = 
      `<a>Biogeochemical</a>
      <a>BGC Derived</a>
      <a>Bio-optical</a>`
    input_param = 'Biogeochemical'
  }

  wrapper(parameter = input_param,plot_type = input_plot_type,selected_wmo=input_wmos,goShip_only)
})

function wrapper(parameter, plot_type, selected_wmo, goShip_only) {
  //Lines to the next comment are very much Chat GPT, but are 
  //required to clear the plotting space after a Leaflet map is generated.
  //Leaflet seems to alter "plot_content," creating issues when displaying
  //scatterplots. It also addresses issues where the map cannot be drawn a 
  //second time after being initialized.  
  const oldContainer = document.getElementById("plot_content");
  const parent = oldContainer.parentNode;

  oldContainer.remove();

  // Recreate the container
  const newContainer = document.createElement("div");
  newContainer.id = "plot_content";
  newContainer.style.width = "800px";
  newContainer.style.height = "300px";
  newContainer.backgroundColor = 'white';
  newContainer.overflow = 'hidden';
  parent.appendChild(newContainer);

  if (plot_type === "Map") {
    make_map(parameter,selected_wmo,goShip_only);
  }

  else {make_plot(parameter,plot_type,selected_wmo,goShip_only).then(result => {
    Plotly.newPlot('plot_content',
      result.traces,
      result.layout,
      { displayModeBar: false }
    );
  })
  }
}

async function make_map(selected_params,selected_wmo,goShip_only){
  const map_data = await metrics_retriever(selected_params,selected_wmo,goShip_only);

  let lon = map_data.map(row => row["LON"]);
  let lat = map_data.map(row => row["LAT"]);
  let DIFF = map_data.map(row => row["DIFF"]);
  let WMO = map_data.map(row => row["WMO"]);
  let CRUISE = map_data.map(row => row["CRUISE"]);

  const {color_scale, min_value, mid_value, max_value } = make_palette(DIFF);

  console.log(min_value)
  console.log(mid_value)
  console.log(max_value)
  var container = L.DomUtil.get('plot_content');

  if(container != null){
    container._leaflet_id = null;
  }

  var map = L.map('plot_content', {
    center: [0,0],
    zoom: 1,
    maxBoundsViscosity: 1.0,
    attributionControl: false,
    maxBounds: [[90,-185],[-90,185]]})

  leafletMap = map; // Save the map so we can remove it later

  const ocean_res = await fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_ocean.json');
  const ocean = await ocean_res.json();
  L.geoJSON(ocean,{color:'#5BBCD6',weight: 0.5,color: 'black',fillColor: '#ADD8E6',fillOpacity: 1}).addTo(map);


  for(let i = 0; i < lon.length; i++){
    let tooltip_string = `<b>WMO: </b> ${WMO[i]} <br><b>CRUISE: </b>${CRUISE[i]}`
    L.circleMarker([lat[i],lon[i]],
      {fillColor: color_scale(DIFF[i]).hex(),color: "black",weight: 0.5,fillOpacity: 1,radius: 2.5})
    .bindTooltip(tooltip_string, 
      {permanent: false, direction: 'top', offset: [0, -5], fillColor: '#0397A8'})
    .addTo(map)
  }

// Continuous Gradient Colorbar
const legend = L.control({ position: 'bottomright' });

//This part was complete cheating. When a legend is added to the map,
//though, this function runs and  
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'info legend');

  // Calculate mid value
  //const mid_value = (min_value + max_value) / 2;

  // Get colors for min, mid, max
  const minColor = color_scale(min_value).hex();
  const midColor = color_scale(mid_value).hex();
  const maxColor = color_scale(max_value).hex();

  div.innerHTML = `
    <div 
      style="
        display: grid; 
        align-items: center; 
        grid-template-rows: 50px 100px;
        grid-template-columns: 40px 40px;">
      <div style="
        grid-area: 1/1/1/2;
        align-items: center;
        margin-right: 10px;">
        <div style="
          font-weight: bold; 
          margin-bottom: 6px; 
          text-align: center; 
          width: 75px;">
          Bottle-Float<br>
          ${selected_params}
        </div>
      </div>
      <div style="
          grid-area: 2/1/2/1;
          background: linear-gradient(
            to top,
            ${minColor} 0%,
            ${midColor} 50%,
            ${maxColor} 100%
          );
          height: 100%;
          width: 60%;
          border: 1px solid black;">
      </div>
      <div style="
        font-size: 12px; 
        display: flex;
        height: 100%;
        text-align: left;
        flex-direction: column;
        grid-area: 2/2/2/3;
        justify-content: space-between">
        <div>${max_value.toFixed(2)}</div>
        <div>${mid_value.toFixed(2)}</div>
        <div>${min_value.toFixed(2)}</div>
      </div>
    </div>
  `;

  div.style.position = 'relative';
  div.style.background = 'white';
  div.style.padding = '8px';
  div.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
  div.style.display = 'grid';
  div.style.alignItems = 'center';

  return div;
};

  legend.addTo(map);

  return map
}

async function make_plot(selected_params,plot_type,selected_wmo,goShip_only){
  const plot_data = await data_retriever(selected_params,selected_wmo,goShip_only);
  const wmo_plot_data = plot_data.selected_data.map(row => row["WMO"]);
  const cruise_plot_data = plot_data.selected_data.map(row => row["CRUISE"]);
  const traces = [];
  const shapes = [];
  const annotations = [];
  let x1_plot_data = null;
  let x2_plot_data = null;
  let y1_plot_data = null;
  let y2_plot_data = null;

  const layout = {
    grid: { rows: 1, columns: 3, pattern: 'independent',
        xgap: .25},
    margin: {t: 0, b: 0, l: 100, r: 10},    
    width: 800,
    height: 300,
    hovermode: 'closest',
    showlegend: true,
    font: {family:  "Menlo,Consolas,monaco,monospace", size: 14},
    plot_bgcolor: 'white',
  };

  for(let i = 0; i < 3; i++){
    if(plot_type=="Scatter Plot"){
      x1_plot_data = plot_data.selected_data.map(row => row[plot_data.param_set_x[i]]);
      y1_plot_data = plot_data.selected_data.map(row => row[plot_data.param_set_y[i]]);
      x2_plot_data = null;
      y2_plot_data = null;
      
      ref_line_x0 = Math.min(...x1_plot_data.filter(Number.isFinite));
      ref_line_y0 = Math.min(...x1_plot_data.filter(Number.isFinite));
      ref_line_x1 = Math.max(...x1_plot_data.filter(Number.isFinite));
      ref_line_y1 = Math.max(...x1_plot_data.filter(Number.isFinite));

      stat_string_join = ""
      diff_data = calculate_diff(x1_plot_data,y1_plot_data,null).diff;

      if(diff_data.length > 3){
        diff_mean = ss.mean(diff_data).toFixed(2)
        diff_sd = ss.standardDeviation(diff_data).toFixed(2)
        diff_med = ss.median(diff_data).toFixed(2)
        stat_string = [`<b>Bottle-Float</b>`,`N = ${diff_data.length}`,`Mean: ${diff_mean}`,
          `Median: ${diff_med}`,`SD: ${diff_sd}`]
        //Note that 
        stat_string_join = stat_string.join("<br>")
      }

      if(plot_data.param_units_x[i]==plot_data.param_units_y[i]){
        one_to_one_start = Math.min(...x1_plot_data.filter(Number.isFinite))
        one_to_one_end = Math.max(...x1_plot_data.filter(Number.isFinite))
      }
    }

    if(plot_type==="Profiles"){
      x1_plot_data = plot_data.selected_data.map(row => row[plot_data.param_set_x[i]]);
      y1_plot_data = plot_data.selected_data.map(row => row["depth"]);
      x2_plot_data = plot_data.selected_data.map(row => row[plot_data.param_set_y[i]]);;
      y2_plot_data = plot_data.selected_data.map(row => row["depth"]);
      //The following creates an array of the same length of param_titles_x and fills
      //with "Depth (m)"
      param_titles_y = Array(param_titles_x.length).fill("Depth")
      param_units_y = Array(param_titles_x.length).fill("(m)")

      ref_line_x0 = 0;
      ref_line_y0 = 0;
      ref_line_x1 = 0;
      ref_line_y1 = 0;

      stat_string_join = ""
    }
   
    if(plot_type==="Anomaly Profiles"){
      x1_data = plot_data.selected_data.map(row => row[plot_data.param_set_x[i]]);
      y1_data = plot_data.selected_data.map(row => row["depth"]);
      x2_data = plot_data.selected_data.map(row => row[plot_data.param_set_y[i]]);;
      y2_plot_data = null;
      
      diff_data = calculate_diff(x1_data,x2_data,y1_data)
      x1_plot_data = diff_data.diff;
      y1_plot_data = diff_data.aux_filter;
      console.log(x1_plot_data.length>3)
      //The following creates an array of the same length of param_titles_x and fills
      //with "Depth (m)"
      param_titles_y = Array(param_titles_x.length).fill("Depth")
      param_units_y = Array(param_titles_x.length).fill("(m)")

      ref_line_x0 = 0;
      ref_line_y0 = 0;
      ref_line_x1 = 0;
      ref_line_y1 = Math.max(...y1_plot_data.filter(Number.isFinite));

      stat_string_join = ""
      if(x1_plot_data.length > 3){
        diff_mean = ss.mean(x1_plot_data).toFixed(2)
        diff_sd = ss.standardDeviation(x1_plot_data).toFixed(2)
        diff_med = ss.median(x1_plot_data).toFixed(2)
        stat_string = [`<b>Bottle-Float</b>`,`N = ${x1_plot_data.length}`,`Mean: ${diff_mean}`,
          `Median: ${diff_med}`,`SD: ${diff_sd}`]
        //Note that 
        stat_string_join = stat_string.join("<br>")
      }
    }

    var current_annotation = {
      text: stat_string_join,
      x: 0.06,
      y: 0.95,
      showarrow: false,
      align: "left",
      //x and y describe a plot position relative to xref and yref. The following
      //commands specify that xref and yref should be set to x1/y1, x2/y2, etc. 
      xref: `x${i + 1} domain`,
      yref: `y${i + 1} domain`,
      //The following provides a hierarchy of fonts to try displaying, mirroring
      //the GO-BGC website
      font: {family:  "Menlo,Consolas,monaco,monospace", size: 10}
    }

    var current_trace_1 = {
      x: x1_plot_data,
      y: y1_plot_data,
      //The following create an array where each element is 
      customdata: wmo_plot_data.map((val,i)=>[val,cruise_plot_data[i]]),
      //Note: the trace name is normally displayed via the <extra> tag.
      //Including <extra></extra> prevents it from being displayed.
      hovertemplate: '<b>WMO: </b>%{customdata[0]} <br><b>Cruise: </b>%{customdata[1]}<extra></extra>',
      type: 'scatter',
      mode: 'markers',
      name: "Bottle Data",
      opacity: 0.7,
      marker: {line: {width: 1},size: 4, opacity: 0.7, color: '#0397A8'},
      xaxis: `x${i+1}`,
      yaxis: `y${i+1}`
    }

    var current_trace_2 = {
      x: x2_plot_data,
      y: y2_plot_data,
      text: wmo_plot_data,
      hovertemplate: '<b>WMO: </b>%{text} <br><b>Cruise:</b><extra></extra>',
      type: 'scatter',
      mode: 'markers',
      name: 'Float Data',
      opacity: 0.7,
      marker: {line: {width: 1},size: 4, opacity: 0.7, color: '#F89D28'},
      xaxis: `x${i+1}`,
      yaxis: `y${i+1}`
    }

  var current_shape = {
      type: 'line',
      x0: ref_line_x0,
      y0: ref_line_y0,
      x1: ref_line_x1,
      y1: ref_line_y1,
      line: {dash: "dash",width:1,color:"red"},
      //x and y describe a plot position relative to xref and yref. The following
      //commands specify that xref and yref should be set to x1/y1, x2/y2, etc. 
      xref: `x${i+1}`,
      yref: `y${i+1}`
    }
    
      //This adjusts the xaxis appearance for a specific subplot
  layout[`xaxis${i+1}`] = {
      showline: true,
      linewidth: 1,
      linecolor: 'black',
      mirror: true,
      showgrid: false,
      zeroline: false,
      title: {text: [param_titles_x[i],param_units_x[i]].join(" "),
      font: {size: 12}},
      automargin: true,
      //title: {text: [x_titles[i],x_units[i]].join(" "),
    }
    
  //This adjusts the yaxis appearance for a specific subplot  
  layout[`yaxis${i+1}`] = {
      //autorange: 'reversed',
      showline: true,
      linewidth: 1,
      linecolor: 'black',
      mirror: true,
      showgrid: false,
      zeroline: false,
      title: {text: [param_titles_y[i],param_units_y[i]].join(" "),
      font: {size: 12}},
      automargin: true,
  }
  //Reverse axis for profiles
  if(plot_type == "Profiles"){
    layout[`yaxis${i+1}`].autorange = 'reversed'
  }
  //Reverse axis and remove legend for anomaly profiles
  if(plot_type == "Anomaly Profiles"){
    layout[`yaxis${i+1}`].autorange = 'reversed'
    layout.showlegend = false;
  }
  //Remove legend for scatter plot
  if(plot_type == "Scatter Plot"){
    layout.showlegend = false;
  }

  if(i > 0){
    current_trace_1.showlegend = false;
    current_trace_2.showlegend = false;
  }

  traces.push(current_trace_1)
  traces.push(current_trace_2)
  shapes.push(current_shape)
  annotations.push(current_annotation)
  }
  layout.annotations = annotations;
  layout.shapes = shapes;
  return {traces, layout}
}