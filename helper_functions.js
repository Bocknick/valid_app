async function get_wmos(goShip_only){
  //param_list = ["WMO_ID","CRUISE_ID","GO_SHIP"]
  let meta_data;
  let wmo_data_error;

  if(goShip_only === true) {
    ({data: meta_data, error: wmo_data_error} = await supa_client
        .from('meta_data')
        .select(`wmo_matchup(WMO)`)
        .eq('GO_SHIP',goShip_only));

    if (wmo_data_error) {
      console.error('Supabase error:', wmo_data_error);
      return;
    }

  } else {
    ({data: meta_data, error: wmo_data_error} = await supa_client
        .from('meta_data')
        .select(`wmo_matchup(WMO)`));
    
    if (wmo_data_error) {
      console.error('Supabase error:', wmo_data_error);
      return;
    }

  }

  return meta_data
}

async function get_map_data(selected_param){
  param_list = ["WMO_ID","PARAM","LAT","LON","DIFF","CRUISE_ID"]
  possible_params = ["Nitrate","pH","Oxygen","DIC","pCO2","Alkalinity","Chlorophyll","Location"]
  possible_units = ["\u03BCmol/kg","Total","\u03BCmol/kg","\u03BCmol/kg","\u03BCatm","\u03BCmol/kg","mg/m^3","Degs."]
  param_test = possible_params.map(row => row === selected_param)
  selected_units = possible_units.filter((_,i)=>param_test[i]);
  legend_title = selected_param + " ("+selected_units+")";

  let metrics_data
  let metrics_error

  ({data: metrics_data, error: metrics_error} = await supa_client
      .from('map_data')
      .select(`wmo_matchup(WMO),cruise_matchup(CRUISE),${param_list.join(',')}`)
      .ilike('PARAM',selected_param));
      
      if (metrics_error) {
      console.error('Supabase error:', metrics_error);
      return;
      }

  return {metrics_data,legend_title}
}

async function make_map(map_data,selected_wmo){
  plot_data = map_data.metrics_data;
  legend_title = map_data.legend_title;

  let lon = plot_data.map(row => row["LON"]);
  let lat = plot_data.map(row => row["LAT"]);
  let DIFF = plot_data.map(row => row["DIFF"]);
  let WMO = plot_data.map(row => row.wmo_matchup.WMO);
  let CRUISE = plot_data.map(row => row.cruise_matchup.CRUISE);

  lon = filter_by_wmo_cruise(lon,WMO,selected_wmo);
  lat = filter_by_wmo_cruise(lat,WMO,selected_wmo);
  DIFF = filter_by_wmo_cruise(DIFF,WMO,selected_wmo);

  const {color_scale, min_value, mid_value, max_value } = make_palette(DIFF);

  var container = L.DomUtil.get('plot_content');

  if(container != null){
    container._leaflet_id = null;
  }
  bounds = L.latlng
  var map = L.map('plot_content', {
    center: [0,0],
    zoom: 1.5,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
    attributionControl: false})
  
  map.fitBounds([[50,-180],[-70,180]])
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

//Create legend, positioned on the bottomright
const legend = L.control({ position: 'bottomright' });

//legend.onAdd runs a specified function when the legend is added to the map
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'info legend');

  // Calculate mid value
  //const mid_value = (min_value + max_value) / 2;

  // Get colors for min, mid, max using chroma color_scale function 
  //(returned by the make_palette function)
  const minColor = color_scale(min_value).hex();
  const midColor = color_scale(0).hex();
  const maxColor = color_scale(max_value).hex();
  
  //Following code structure mostly from chat GPT with modifications
  //(e.g., grid layout) to improve appearance. Note that in grid-layout
  //grid-area definitions are non-inclusive. Format is
  //start_row/start_col/end_row/end_col
  div.innerHTML = `
    <div id = legend_container style="
        display: grid; 
        border: 1px solid;
        border-color: black;
        padding: 5px;
        align-items: center; 
        grid-template-rows: 70px 100px;
        grid-template-columns: 40px 40px;">
      <div id = title_text style="
        grid-area: 1/1/2/3;
        align-items: center;
        text-align: center;
        width: 100%;
        margin-bottom: 10px;">
        <b>Bottle-Float<br>
        ${legend_title}</b>
      </div>
      <div id colorbar style="
          grid-area: 2/1/2/1;
          margin-left: 5px;
          background: linear-gradient(
            to top,
            ${minColor} 0%,
            ${midColor} 50%,
            ${maxColor} 100%
          );
          height: 100%;
          width: 60%;">
      </div>
      <div id colorbar_text style="
        font-size: 12px; 
        display: flex;
        height: 100%;
        text-align: left;
        flex-direction: column;
        grid-area: 2/2/2/3;
        justify-content: space-between">
        <div>${max_value.toFixed(2)}</div>
        <div>${0}</div>
        <div>${min_value.toFixed(2)}</div>
      </div>
    </div>
  `;

  div.style.position = 'relative';
  div.style.border = "black"
  div.style.background = 'white';
  //div.style.padding = '8px';
  //div.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
  div.style.display = 'grid';
  div.style.alignItems = 'center';

  return div;
};
  //Add legend to map; legend is styled based on legend.onAdd
  legend.addTo(map);
  
  return map
}


async function get_profile_data(selected_params){
  param_set_x = [];
  param_set_y = [];
  let selected_data;
  let data_error;

  if(selected_params == "Biogeochemical"){
    param_set_x = ["bottle_oxygen","bottle_nitrate","bottle_ph"];
    param_set_y = ["float_oxygen","float_nitrate","float_ph"];
    //Splitting the units and the title makes it easier to compare units for each plot
    //to decide whether or not to draw 1-to-1 line
    param_units_x = ["(\u03BCmol/kg)","(\u03BCmol/kg)","total"]
    param_units_y = ["(\u03BCmol/kg)","(\u03BCmol/kg)","total"]
    param_titles_x = ["Bottle Oxygen","Bottle Nitrate","Bottle pH in situ"]
    param_titles_y = ["Float Oxygen","Float Nitrate","Float pH in situ"]
  }

  if(selected_params == "BGC Derived"){
    param_set_x = ["bottle_pco2","bottle_dic","bottle_alk"];
    param_set_y = ["float_pco2","float_dic","float_alk"];
    param_units_x = ["(\u03BCatm)","(\u03BCmol/kg)","(\u03BCmol/kg)"]
    param_units_y = ["(\u03BCatm)","(\u03BCmol/kg)","(\u03BCmol/kg)"]
    param_titles_x = ["Bottle PCO2","Bottle DIC","Bottle Alk."]
    param_titles_y = ["Float PCO2","Float DIC","Float Alk."]
  }

  if(selected_params == "Bio-optical"){
    param_set_x = ["bottle_poc","bottle_chl"];
    param_set_y = ["float_bbp","float_chl"];
    param_units_x = ["(mg/m^3)","(mg/m^3)"]
    param_units_y = ["(m^-1)","(mg/m^3)"]
    param_titles_x = ["Bottle POC","Bottle CHL"]
    param_titles_y = ["Float BBP","Float CHL"]
  }
  selected_params = param_set_x.concat(param_set_y,'depth');

  ({data: selected_data, error: data_error} = await supa_client
      .from('profile_data')
      //.select requires a list of items separated by commas,
      //hence x_params.join(',')
      .select(`CRUISE_ID,wmo_matchup(WMO),cruise_matchup(CRUISE),${selected_params.join(',')}`));
      
      if (data_error) {
        console.error('Supabase error:', data_error);
        return;
      }

  return {selected_data,param_set_x,param_set_y,
          param_units_x,param_units_y,param_titles_x,param_titles_y}
}

function make_palette(input_data){
  //Note use of spread operator (...) to unlist array
  const min_value = Math.min(...input_data)
  const mid_value = ss.median(input_data)
  const max_value = Math.max(...input_data)
  const color_scale =  chroma.scale(['5083BB','FFFFBF','DE3F2E']).domain([min_value,0, max_value]);
  //const color_values = input_data.map(val => color_scale(val).hex());

  //Create binned values depending on specified resolution
  //data_values_binned = input_data.map(row => Math.round(row/resolution) * resolution)
  //Create array of unique bin values
  //data_bins = [...new Set(data_values_binned)].sort()
  //palette = chroma.scale('Spectral').colors(data_bins.length)
  //color_values = data_values_binned.map(row => palette[data_bins.indexOf(row)])
  return { color_scale, min_value, mid_value, max_value};
}

function calculate_diff(x,y,aux){

  //Create keep as array of booleans indicating whether numeric values are available
  //for both x and y at the given index
  const keep = x.map((val,i) => Number.isFinite(val) && Number.isFinite(y[i]));

  let aux_filter = null;
  if(aux != null){
    //.filter() iterates through an array and only keeps elements that pass a 
    //conditional test. In the following, the test is just whether the corresponding
    //value of keep is true/false.
    aux_filter = aux.filter((_,i)=>keep[i]);
  }

  //x.filter only retains values from x where keep == TRUE
  const x_filter = x.filter((_,i)=>keep[i]);
  //y.filter only retains values from y where keep == TRUE
  const y_filter = y.filter((_,i)=>keep[i]);
  //x_filter.map calculates the difference between x_filter and y_filter
  //for each element in x_filter.
  const diff = x_filter.map((val,i) => val-y_filter[i]);
  return {diff,aux_filter,x_filter,y_filter};
}

//Model II regression code adapted from MATLAB provided at...
//https://www.mbari.org/technology/matlab-scripts/linear-regressions/
const model_II_regress = (X,Y) => {
    n = X.length
    Sx = X.reduce((a,b) => a + b);
    Sy = Y.reduce((a,b) => a + b,0);
    xbar = Sx/n;
    ybar = Sy/n;

    U = X.map(row => row - xbar);
    V = Y.map(row => row - ybar);
    UV = U.map((row,i) => row * V[i])
    SUV = UV.reduce((a,b) => a + b)
    U2 = U.map(row => row**2);
    V2 = V.map(row => row**2);
    SU2 = U2.reduce((a,b) => a + b);
    SV2 = V2.reduce((a,b) => a+b)

    sigx = (SU2/(n-1))**(1/2)
    sigy = (SV2/(n-1))**(1/2)
    slope = ((SV2 - SU2 + Math.sqrt(((SV2 - SU2)**2)+(4 * SUV**2)))/(2*SUV))
    intercept = ybar - slope * xbar
    r = SUV/Math.sqrt(SU2 * SV2)
    r2 = r**2
    return {slope, intercept, r, r2};
}

//The HTML runs autocomplete via JS with inp = "myInput" and arr = countries
//"myInput" is the ID for the HTML input field
function autocomplete(inp, arr) {
  /*the autocomplete function takes two arguments,
  the text field element and an array of possible autocompleted values:*/
  var currentFocus;
  //An event listener is added to inp; this is kind of crazy. The javascript
  //function can monitor the HTML element even within the context of the function?
  inp.addEventListener("input", function(e) {
      //'this' refers to the element the event listener is attached to.
      //'this.value' returns the value that 'this' contains.
      //a, b, and i are all undeclared in this case. Only val is assigned to this.value
      //The following formatting leaves a, b, i undeclared.
      var a, b, i, val = this.value;
      /*close any already open lists of autocompleted values*/
      closeAllLists();
      if (!val) { return false;}
      currentFocus = -1;
      //This creates a container for the matching elements
      a = document.createElement("DIV");
      //This sets the css id for a to 'autocomplete-list,' which is defined in the CSS
      a.setAttribute("id", this.id + "autocomplete-list");
      //This sets the css class for 'a' to 'autocomplete-items.'
      a.setAttribute("class", "autocomplete-items");
      /*append the DIV element as a child of the autocomplete container:*/
      this.parentNode.appendChild(a);
      //This loops through each element in the input array
      for (i = 0; i < arr.length; i++) {
  
        //This takes element 'i' from array, creates a substring from the start of the element
        //to the current legnth of val (which corresponds to the input from the event listener),
        //and evaluates whether it matches the current value
        if (String(arr[i]).slice(0, val.length) == String(val)) {
          //In the event of a match, the following code creates a div container 'b' 
          b = document.createElement("DIV");
          //Sets the matching segment of arr[i] to bold face
          b.innerHTML = "<strong>" + String(arr[i]).slice(0, val.length) + "</strong>";
          //I think this part adds the current arr value to other matches?
          b.innerHTML += String(arr[i]).slice(val.length);
          //and does something else
          b.innerHTML += "<input type='hidden' value='" + String(arr[i]) + "'>";
          //The following adds a listener to b, and changes the value of inp to 
          b.addEventListener("click", function(e) {
            /*insert the value for the autocomplete text field:*/
            inp.value = this.getElementsByTagName("input")[0].value;
            /*close the list of autocompleted values,
            (or any other open lists of autocompleted values:*/
            closeAllLists();
          });
          a.appendChild(b);
        }
      }
  });
  //This listener listens for a keypress
  inp.addEventListener("keydown", function(e) {
      //If a keypress occurs, the id of the selected item is stored as x
      var x = document.getElementById(this.id + "autocomplete-list");
      //Not sure what this line does
      if (x) x = x.getElementsByTagName("div");
      //If the DOWN key is pressed, currentFocus is increased (initialized as -1)
      if (e.keyCode == 40) {
        /*If the arrow DOWN key is pressed,
        increase the currentFocus variable:*/
        currentFocus++;
        //Run addActive function
        addActive(x);
      } else if (e.keyCode == 38) { //up
        /*If the arrow UP key is pressed,
        decrease the currentFocus variable:*/
        currentFocus--;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x) x[currentFocus].click();
        }
      }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
      x[i].parentNode.removeChild(x[i]);
    }
  }
}
/*execute a function when someone clicks in the document:*/
document.addEventListener("click", function (e) {
    closeAllLists(e.target);
});
} 


function filter_by_wmo_cruise(input_data,input_wmos,selected_wmos){
  wmo_test = input_wmos.map(row => selected_wmos.includes(row));
  data_result = input_data.filter((_,i)=>wmo_test[i]);
  return(data_result);
}

function make_plot(plot_data,plot_type,selected_wmos,do_log,do_reg){
  //const plot_data = await get_profile_data(selected_params,selected_wmo,goShip_only);
  const wmo_plot_data = plot_data.selected_data.map(row => row.wmo_matchup.WMO);
  const cruise_plot_data = plot_data.selected_data.map(row => row.cruise_matchup.CRUISE);
  const traces = [];
  const shapes = [];
  const annotations = [];
  
  let x1_plot_data = null;
  let x2_plot_data = null;
  let y1_plot_data = null;
  let y2_plot_data = null;

  let layout = {
    grid: { rows: 1, columns: 3, pattern: 'independent',
      xgap: 0.2},
    autoexpand: true,
    //margin controls the margin of the entire plotting area,
    //not individual subplots. Note that plotly's default
    //margins are relatively large, so removing the margin
    //line results in more comptessed plots. Also, The plot title
    //appears within the margin, so too small of a margin will push the
    //title into the axis
    margin: {t: 10, b: 50, l: 50, r: 50},    
    width: 750,
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
      x1_plot_data = filter_by_wmo_cruise(x1_plot_data,wmo_plot_data,selected_wmos)
      y1_plot_data = filter_by_wmo_cruise(y1_plot_data,wmo_plot_data,selected_wmos)

      ref_line_x0 = Math.min(...x1_plot_data.filter(Number.isFinite));  
      ref_line_y0 = Math.min(...x1_plot_data.filter(Number.isFinite));
      ref_line_x1 = Math.max(...x1_plot_data.filter(Number.isFinite));
      ref_line_y1 = Math.max(...x1_plot_data.filter(Number.isFinite));
      let round_to = 2;
      same_units = plot_data.param_units_x[i]==plot_data.param_units_y[i]

      stat_string_display = ""
      diff_data = calculate_diff(x1_plot_data,y1_plot_data,null).diff;

      if(do_log===true){
        x1_plot_data = x1_plot_data.map(row => Math.log10(row));
        y1_plot_data = y1_plot_data.map(row => Math.log10(row));
          
        ref_line_x0 = Math.min(...x1_plot_data.filter(Number.isFinite));  
        ref_line_y0 = Math.min(...x1_plot_data.filter(Number.isFinite));
        ref_line_x1 = Math.max(...x1_plot_data.filter(Number.isFinite));
        ref_line_y1 = Math.max(...x1_plot_data.filter(Number.isFinite));
      }

      if(same_units !== true){
        round_to = 5;
        ref_line_x0 = Math.min(...x1_plot_data.filter(Number.isFinite));  
        ref_line_y0 = Math.min(...y1_plot_data.filter(Number.isFinite));
        ref_line_x1 = Math.max(...x1_plot_data.filter(Number.isFinite));
        ref_line_y1 = Math.max(...y1_plot_data.filter(Number.isFinite));

        stat_string = [`<b>Bottle-Float</b>`,`N = ${diff_data.length}`,`Mean: --`,
          `Median: --`,`SD: --`]
        //Note that 
        stat_string_display = stat_string.join("<br>")
      }

      filt_data = calculate_diff(x1_plot_data,y1_plot_data);
      x1_plot_data = filt_data.x_filter;
      y1_plot_data = filt_data.y_filter; 

      if(diff_data.length > 3 & do_reg === false & same_units === true){
        diff_mean = ss.mean(diff_data).toFixed(2)
        diff_sd = ss.standardDeviation(diff_data).toFixed(2)
        diff_med = ss.median(diff_data).toFixed(2)
        stat_string = [`<b>Bottle-Float</b>`,`N = ${diff_data.length}`,`Mean: ${diff_mean}`,
          `Median: ${diff_med}`,`SD: ${diff_sd}`]
        //Note that 
        stat_string_display = stat_string.join("<br>")
      }

      if(do_reg===true & x1_plot_data.length>3){
        reg_result = model_II_regress(x1_plot_data, y1_plot_data);
        slope = reg_result.slope
        intercept = reg_result.intercept
        r2 = reg_result.r2.toFixed(2)
        stat_string = [`<b>Model II Regression</b>`,`N = ${x1_plot_data.length}`,`Y = ${Number(slope.toFixed(round_to))}X + ${Number(intercept.toFixed(round_to))}`,`<b>R2</b> = ${r2}`]
        stat_string_display = stat_string.join("<br>");
        
        ref_line_y0 = slope * ref_line_x0 + intercept;
        ref_line_y1 = slope * ref_line_x1 + intercept;
        console.log(`slope: ${slope}`)
      }
    }

    if(plot_type==="Profiles"){
      x1_plot_data = plot_data.selected_data.map(row => row[plot_data.param_set_x[i]]);
      y1_plot_data = plot_data.selected_data.map(row => row["depth"]);
      x2_plot_data = plot_data.selected_data.map(row => row[plot_data.param_set_y[i]]);;
      y2_plot_data = plot_data.selected_data.map(row => row["depth"]);
      
      x1_plot_data = filter_by_wmo_cruise(x1_plot_data,wmo_plot_data,selected_wmos)
      y1_plot_data = filter_by_wmo_cruise(y1_plot_data,wmo_plot_data,selected_wmos)
      x2_plot_data = filter_by_wmo_cruise(x2_plot_data,wmo_plot_data,selected_wmos)
      y2_plot_data = filter_by_wmo_cruise(y2_plot_data,wmo_plot_data,selected_wmos)
      //The following creates an array of the same length of param_titles_x and fills
      //with "Depth (m)"
      param_titles_y = Array(param_titles_x.length).fill("Depth")
      param_units_y = Array(param_titles_x.length).fill("(m)")

      ref_line_x0 = Math.min(...x1_plot_data.filter(Number.isFinite));
      ref_line_y0 = Math.min(...x1_plot_data.filter(Number.isFinite));
      ref_line_x1 = Math.min(...x1_plot_data.filter(Number.isFinite));
      ref_line_y1 = Math.min(...x1_plot_data.filter(Number.isFinite));

      stat_string_display = ""
    }
   
    if(plot_type==="Anomaly Profiles"){
      x1_data = plot_data.selected_data.map(row => row[plot_data.param_set_x[i]]);
      y1_data = plot_data.selected_data.map(row => row["depth"]);
      x2_data = plot_data.selected_data.map(row => row[plot_data.param_set_y[i]]);;
      y2_plot_data = null;
      
      x1_data = filter_by_wmo_cruise(x1_data,wmo_plot_data,selected_wmos)
      x2_data = filter_by_wmo_cruise(x2_data,wmo_plot_data,selected_wmos)
      y1_data = filter_by_wmo_cruise(y1_data,wmo_plot_data,selected_wmos)

      diff_data = calculate_diff(x1_data,x2_data,y1_data)
      x1_plot_data = diff_data.diff;
      y1_plot_data = diff_data.aux_filter;

      //The following creates an array of the same length of param_titles_x and fills
      //with "Depth (m)"
      param_titles_y = Array(param_titles_x.length).fill("Depth")
      param_units_y = Array(param_titles_x.length).fill("(m)")

      ref_line_x0 = 0;
      ref_line_y0 = 0;
      ref_line_x1 = 0;
      ref_line_y1 = Math.max(...y1_plot_data.filter(Number.isFinite));

      stat_string_display = ""
      if(x1_plot_data.length > 3){
        diff_mean = ss.mean(x1_plot_data).toFixed(2)
        diff_sd = ss.standardDeviation(x1_plot_data).toFixed(2)
        diff_med = ss.median(x1_plot_data).toFixed(2)
        stat_string = [`<b>Bottle-Float</b>`,`N = ${x1_plot_data.length}`,`Mean: ${diff_mean}`,
          `Median: ${diff_med}`,`SD: ${diff_sd}`]
        //Note that 
        stat_string_display = stat_string.join("<br>")
      }
    }

    var current_annotation = {
      text: stat_string_display,
      x: 0.06,
      y: 0.97,
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
      linewidth: .5,
      linecolor: 'black',
      tickfont: {size: 12},
      showgrid: true,
      zeroline: false,
      title: {text: [param_titles_x[i],param_units_x[i]].join(" "),
        font: {size: 12}, standoff: 7},
      automargin: false,
      //title: {text: [x_titles[i],x_units[i]].join(" "),
    }
    
  //This adjusts the yaxis appearance for a specific subplot  
  layout[`yaxis${i+1}`] = {
      //autorange: 'reversed',
      showline: true,
      linewidth: .5,
      linecolor: 'black',
      tickfont: {size: 10},
      showgrid: true,
      zeroline: false,
      title: {text: [param_titles_y[i],param_units_y[i]].join(" "),
        font: {size: 12},standoff: 3},
      automargin: false,
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

function refresh(){
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
}
