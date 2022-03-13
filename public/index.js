let transactions = [];
let myChart;

fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}
//Indexed DB Start
let db;

const request = window.indexedDB.open("budget", 1);
      // Create schema
      request.onupgradeneeded = event => {
        db = event.target.result;

        // Creates an object store with a listID keypath that can be used to query on.
        const budgetStore = db.createObjectStore("budget", {
          keyPath: "transactionID",
          autoIncrement: true
        });
        //budgetStore.createIndex("loadStatusIndex","loadStatus")
      };
    request.onsuccess = () =>{
    db = request.result;
    updateLive();
}

saveRecord = (newItem) => {
  const saveTransaction = db.transaction("budget", "readwrite");
  const budgetStore = saveTransaction.objectStore("budget");
  //const loadStatusIndex = budgetStore.index("loadStatusIndex"); 
  budgetStore.add(newItem);
};

//function to run post request with data from indexedDB
updateLive = async () => {

  if(navigator.onLine){
    // if browser is online, get data from indexedDB
    const updateMongoTransaction = db.transaction("budget", "readonly");
    const updateMongoStore = updateMongoTransaction.objectStore("budget");
    const offlinePosts = updateMongoStore.getAll();
    console.log(offlinePosts);
      offlinePosts.onsuccess = async () => {
        const updatedPosts = await offlinePosts.result.forEach((post) => {
          fetch("/api/transaction", {
          method: "POST",
          body: JSON.stringify(post),
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json"
          }
        })
      });  
        // add db clear transaction here
        const deleteTransaction = db.transaction("budget", "readwrite");
        const deleteTransactionStore = deleteTransaction.objectStore("budget");
        const deletedStore = await deleteTransactionStore.clear(); 
        console.log("DB Scrubbed!");
        return deletedStore
    }
  }
  else{
   console.log("All up to date! Or offline.");
  }
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    console.log("saveRecord ran")
    saveRecord(transaction);
    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};