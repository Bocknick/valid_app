//supabase.createCline connects to the supabase server
const supa_client = supabase.createClient(
      'https://hqbrjoqmadigbeteekmc.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYnJqb3FtYWRpZ2JldGVla21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjEyMTgsImV4cCI6MjA2NTM5NzIxOH0.6k1qFWdz8SL5UbFMX44oVHmjIMmpiZIl6k351FXXzGg'
);

const container = document.getElementById('app-container');
container.innerHTML =
    `<div class = "app-container">
        <div class = "controls">
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
          <form id = 'wmo_form' autocomplete="off" style = "width:200px; display:flex; gap: 4px;">
              <div class="autocomplete" style="flex: 2;">
                  <input id="wmo_input" type="text" placeholder="WMO" style = "width: 100%; font-size: 14px;">
              </div>
              <input type="submit" value = "Filter" style = "flex: 1; margin-bottom: 5px; font-size: 14px; padding: 12px;">
          </form>
          <form id = 'dist_form' autocomplete="off" style = "width:200px; display:flex; gap: 4px;">
            <div class="autocomplete" style="flex: 2;">
                <input id="dist_input" type="text" placeholder="Dist. (km)" style = "width: 100%; font-size: 14px;">
            </div>
            <input id = "dist_submit" type="submit" value = "Filter" style = "flex: 1; width: 75px; margin-bottom: 5px; width: 100px; font-size: 14px; padding: 12px;">
          </form>
          <div id = "reset">
            <button>Reset Selections</button>
          </div>
          <a href = "https://www.go-bgc.org/wp-content/uploads/2024/11/Float_vs_Bottle_Table.txt" class = "file_link_button">Download Data</a>
          <a href = "https://www.go-bgc.org/wp-content/uploads/2024/11/README_FLOATvsBOTTLE.txt" class = "file_link_button">Readme</a><br>
          <div class checkbox">
              <input type="checkbox" id="goship_checkbox">
              <label for="goship_checkbox">GO-SHIP only</label>
          </div>
          <div class checkbox id = "log_content">
              <input type="checkbox" id="log_checkbox">
              <label for="log_checkbox">Log Transform Axes</label>
          </div>
          <div class checkbox" id = "reg_content">
              <input type="checkbox" id="regs_checkbox">
              <label for="regs_checkbox">Plot Regressions</label>
          </div>
        </div>
        <div id="plot_content" style="width:600px;height:300px;"></div>
    </div>`



//Define a bunch of globals
const dropdown_options = document.getElementById('param_content')
let input_param = "Biogeochemical"
let goShip_only = false;
let do_reg = false;
let do_log = false;
let input_plot_type = "Scatter Plot"
let input_plot_data;
let input_map_data;
let selected_wmos;
let max_dist = 5000;

//Grab HTML elements for listeners
const param_content = document.getElementById('param_content');
const plot_type_content = document.getElementById("plot_type");
const go_ship_state = document.getElementById("goship_checkbox");
const log_state = document.getElementById("log_checkbox");
const reg_state = document.getElementById("regs_checkbox");
const wmo_form = document.getElementById('wmo_form');
const dist_form = document.getElementById('dist_form');
const reset_clicked = document.getElementById('reset');
//Run metadata retriever; generate initial wmo_list and 
//run wrapper with all wmos
get_wmos(goShip_only).then(result => {
  wmo_list = result.map(row => row.wmo_matchup.WMO);
  selected_wmos = wmo_list
  autocomplete(document.getElementById("wmo_input"), selected_wmos);

  //Run wrapper for the first time using default input_param
  //and input_plot_type to load initial plot view
  //get_profile_data is an async function, so another.then is needed
  //containing make_plot()
  get_profile_data(input_param,max_dist).then(result => {
    input_plot_data = result;
    plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
  })
})

//Get the wmo_form <form> object and add a listener to the submit <input> object
dist_form.addEventListener('submit', function(event) {
    //The browser will reload the page by default when a form is submitted. 
    //preventDefault() prevents this behavior.
    event.preventDefault();
    max_dist = [Number(document.getElementById('dist_input').value)];
    if(Number(document.getElementById('dist_input').value)==0){
      max_dist = 5000;
    }
    if(input_plot_type === "Map"){
      get_map_data(input_param,max_dist).then(result => {
        input_map_data = result
        plot_wrapper(input_map_data,input_plot_type,selected_wmos,do_log,do_reg);
      })
    }else{
      get_profile_data(input_param,max_dist).then(result => {
        input_plot_data = result;
        plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
      })
    }
});

//Get the wmo_form <form> object and add a listener to the submit <input> object
wmo_form.addEventListener('submit', function(event) {
    //The browser will reload the page by default when a form is submitted. 
    //preventDefault() prevents this behavior.
    event.preventDefault();
    selected_wmos = [Number(document.getElementById('wmo_input').value)];
    if(Number(document.getElementById('wmo_input').value)==0){
      selected_wmos = wmo_list;
    }
    //Filter copy of plot data
    plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
});

//listen for a change of checkedness for go_ship
go_ship_state.addEventListener("change",function(event){
    if (go_ship_state.checked) {
        get_wmos(true).then(result => {
          selected_wmos = result.map(row => row.wmo_matchup.WMO)
          plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
        });
        //Filter copy of plot data
    } else {
        get_wmos(false).then(result => {
          selected_wmos = result.map(row => row.wmo_matchup.WMO)
          plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
        });
        //Revert to full plot data

    }
})

//listen for a click on param_content
reg_state.addEventListener("change",function(event){
    if (reg_state.checked) {
      do_reg = true;
      plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
    } else {
        //Calculate stat string based on difference, etc.
      do_reg = false;
      plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
    }
})

//listen for a click on log checkbox
log_state.addEventListener("change",function(event){
    if (log_state.checked) {
        //Log transform plot_data
        do_log=true;
        plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
    } else {
        //Revert to original plot_data
        do_log=false;
        plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
    }
})

//listen for a click on param_content
param_content.addEventListener("click",function(event){
  refresh();
  if(event.target.tagName == "A"){
    input_param = event.target.textContent
    if(input_plot_type === "Map"){
      get_map_data(input_param).then(result => {
        input_map_data = result
        plot_wrapper(input_map_data,input_plot_type,selected_wmos,do_log,do_reg);
      })
    }else{
      get_profile_data(input_param,max_dist).then(result => {
        input_plot_data = result;
        plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
      })
    }
  }
})

//Listen for plot_type selections
//If plot type changes, redraw map with existing data
plot_type_content.addEventListener("click",function(event){
  refresh();
  const reg_content = document.getElementById("reg_content");
  const log_content = document.getElementById("log_content");
  dropdown_options.innerHTML = 
      `<a>Biogeochemical</a>
      <a>BGC Derived</a>
      <a>Bio-optical</a>`
  input_param = 'Biogeochemical'
  if(event.target.tagName == "A"){
    input_plot_type = event.target.textContent
  }
  if(input_plot_type != "Scatter Plot"){
    log_content.style.display = 'none';
    reg_content.style.display = 'none';
  } else{
    log_content.style.display = 'inline-block';
    reg_content.style.display = 'inline-block';
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
      <a>Space</a>
      <a>Time</a>`
    input_param = "Nitrate"
    get_map_data(input_param,max_dist).then(result => {
      input_map_data = result
      plot_wrapper(input_map_data,input_plot_type,selected_wmos,do_log,do_reg);
    })
  } else{
      plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
    }
  })


reset_clicked.addEventListener('click', function(event){
  refresh()
  input_param = "Biogeochemical"
  goShip_only = false;
  do_reg = false;
  do_log = false;
  input_plot_type = "Scatter Plot"
  max_dist = 5000;
  get_profile_data(input_param,max_dist).then(result => {
    input_plot_data = result;
    plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
  })
})

function plot_wrapper(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg){
  if(input_plot_type == "Map"){
    make_map(input_map_data,selected_wmos);
  } else{
    display_plot = make_plot(input_plot_data,input_plot_type,selected_wmos,do_log,do_reg);
    Plotly.newPlot('plot_content',
      display_plot.traces,
      display_plot.layout,
      { displayModeBar: false }
    );
  }
}
