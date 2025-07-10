async function metadata_retriever(goShip_only){
  //param_list = ["WMO_ID","CRUISE_ID","GO_SHIP"]
  let meta_data;
  let wmo_data_error;

  if(goShip_only === true) {
    ({data: meta_data, error: wmo_data_error} = await supa_client
        .from('meta_data')
        .select(`wmo_matchup(WMO),${selected_params.join(',')}`)
        .eq('go_ship',goShip_only))

    if (wmo_data_error) {
      console.error('Supabase error:', wmo_data_error);
      return;
    }

  } else {
    ({data: meta_data, error: wmo_data_error} = await supa_client
        .from('meta_data')
        .select(`wmo_matchup(WMO)`))
    
    if (wmo_data_error) {
      console.error('Supabase error:', wmo_data_error);
      return;
    }

  }

  return meta_data
}

async function metrics_retriever(selected_param,selected_wmo,goShip_only){


  param_list = ["WMO_ID","PARAM","LAT","LON","DIFF","CRUISE_ID"]
  possible_params = ["Nitrate","pH","Oxygen","DIC","pCO2","Alkalinity","Chlorophyll","Location"]
  possible_units = ["\u03BCmol/kg","Total","\u03BCmol/kg","\u03BCmol/kg","\u03BCatm","\u03BCmol/kg","mg/m^3","Degs."]
  param_test = possible_params.map(row => row === selected_param)
  selected_units = possible_units.filter((_,i)=>param_test[i]);
  legend_title = selected_param + " ("+selected_units+")";
  console.log(legend_title);

  let metrics_data
  let metrics_error
  let wmo_ids

  ({data: wmo_ids, error: wmo_error} = await supa_client
    .from('wmo_matchup')
    .select('WMO_ID,WMO')
    .in('WMO',selected_wmo));

    if(wmo_error){
      console.error('Supabase error:', metrics_error);
      return;
    }
  
  selected_ids = wmo_ids.map(row => row['WMO_ID']);
  
  if(goShip_only === true){
    ({data: metrics_data, error: metrics_error} = await supa_client
        .from('map_data')
        .select(`wmo_matchup(WMO),cruise_matchup(CRUISE),${param_list.join(',')}`)
        .ilike('PARAM',selected_param)
        .in('WMO_ID',selected_ids)
        .eq('GO_SHIP',goShip_only));
        
        if (metrics_error) {
        console.error('Supabase error:', metrics_error);
        return;
        }
    } else{
    ({data: metrics_data, error: metrics_error} = await supa_client
        .from('map_data')
        .select(`wmo_matchup(WMO),cruise_matchup(CRUISE),${param_list.join(',')}`)
        .ilike('PARAM',selected_param)
        .in('WMO_ID',selected_ids));
        
        if (metrics_error) {
        console.error('Supabase error:', metrics_error);
        return;
        }
    }

  return {metrics_data,legend_title}
}

async function data_retriever(selected_params,selected_wmo,goShip_only){
  param_set_x = [];
  param_set_y = [];
  let selected_data;
  let data_error;
  let wmo_ids;
  let wmo_error;
  let cruise_ids;

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

  //Retrieve WMO_IDs for current WMOs
  ({ data: wmo_ids, error: wmo_error} = await supa_client
    .from('wmo_matchup')
    .select('WMO_ID,WMO')
    .in('WMO',selected_wmo));

    if(wmo_error){
      console.error('Supabase error:', wmo_error);
      return;
    }
  
  //Retrieve CRUISE_IDs for 
  const selected_ids = wmo_ids.map(row => row['WMO_ID']);
  if(goShip_only === true){
    //Retrieve CRUISE_IDs for GO_SHIP cruises
    //Retrieve WMO_IDs for current WMOs
    ({data: cruise_ids, error: cruise_error} = await supa_client
      .from('meta_data')
      .select('CRUISE_ID,GO_SHIP')
      .eq('GO_SHIP',goShip_only));

      if(cruise_error){
        console.error('Supabase error:', wmo_error);
        return;
      }
    
    let selected_cruises = cruise_ids.map(row => row["CRUISE_ID"])
    selected_cruises = [...new Set(selected_cruises)];
    ({data: selected_data, error: data_error} = await supa_client
        .from('profile_data')
        //.select requires a list of items separated by commas,
        //hence x_params.join(',')
        .select(`CRUISE_ID,wmo_matchup(WMO),cruise_matchup(CRUISE),${selected_params.join(',')}`)
        .in('CRUISE_ID',selected_cruises));
        
        if (data_error) {
          console.error('Supabase error:', data_error);
          return;
        }
  } else{
    ({data: selected_data, error: data_error} = await supa_client
        .from('profile_data')
        //.select requires a list of items separated by commas,
        //hence x_params.join(',')
        .select(`wmo_matchup(WMO),cruise_matchup(CRUISE),${selected_params.join(',')}`)
        .in('WMO_ID',selected_ids));
        
        if (data_error) {
          console.error('Supabase error:', data_error);
          return;
        }
  }

//console.log(JSON.stringify(selected_data[0]));  
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

//From didinko on StackOverflow
//https://stackoverflow.com/questions/6195335/linear-regression-in-javascript
const regress = (x, y) => {
    const n = y.length;
    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
        sx += x[i];
        sy += y[i];
        sxy += x[i] * y[i];
        sxx += x[i] * x[i];
        syy += y[i] * y[i];
    }
    const mx = sx / n;
    const my = sy / n;
    const yy = n * syy - sy * sy;
    const xx = n * sxx - sx * sx;
    const xy = n * sxy - sx * sy;
    const slope = xy / xx;
    const intercept = my - slope * mx;
    const r = xy / Math.sqrt(xx * yy);
    const r2 = Math.pow(r,2);
    let sst = 0;
    for (let i = 0; i < n; i++) {
       sst += Math.pow((y[i] - my), 2);
    }
    const sse = sst - r2 * sst;
    const see = Math.sqrt(sse / (n - 2));
    const ssr = sst - sse;
    return {slope, intercept, r, r2, sse, ssr, sst, sy, sx, see};
}
regress([1, 2, 3, 4, 5], [1, 2, 3, 4, 3]);

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