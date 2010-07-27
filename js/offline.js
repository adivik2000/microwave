function searchStyle(waveId){
  if(cacheState[waveId] == 2){
    return 'fresh_cache';
  }else if(cacheState[waveId] == 1){
    return 'old_cache';
  }
  return '';
}

function onLine(){
	//var val = navigator.onLine;
	var val = false;
	if(val == false){
		document.getElementById('offline_head').style.display = '';
		document.getElementById('online_head').style.display = 'none'
	}
	return val;
}


var cachequeue = [];
function open_db(){
if(!window.db)
		window.db = openDatabase('waves', '1.0', 'Offline Wave Cache', 5 * 1024 * 1024);
}
function offline_cache(){
  if(onLine() == false) return;
  open_db();
  db.transaction(function(tx){
	tx.executeSql("DROP TABLE inbox");
  })
  callbacks[wave.robot.search('in:inbox',0,42)] = function(msg){
    var item, digests = msg.data.searchResults.digests;
    for(var i = 0; i < digests.length; i++){
      item = digests[i];
      cachequeue.push(item);
	  
	  console.log(item.waveId)
    }
	setTimeout(cache_cycle, 1000);
  }
  runQueue();
}

var cacheState = {}; //0 = uncached, 1 = cached but outdated, 2 = cached and new
try{
	if(window.localStorage && localStorage.cacheState){
		var cs = JSON.parse(localStorage.cacheState);
		for(var i = 0; i < cs.length; i++){
			cacheState[cs[i]] = 1;
		}
		//cacheState = JSON.parse(localStorage.cacheState)
	}
}catch(err){}

function offline_loadWave(waveId){
open_db()
db.transaction(function(tx){
  tx.executeSql('SELECT * FROM inbox WHERE waveid = ?', [waveId], function (tx, results) {
    var waveContent = JSON.parse(results.rows.item(0).data)
    console.log(waveContent);
    window.msg = waveContent;
    if(msg.error){
      if(msg.error.message.indexOf('not a participant') != -1){
        alert('You are not a participant of the wave/wavelet. \nThis may be due to a bug in the current version of the data api which does not allow access to waves unless you are explicitly a participant. don\'t blame me')
        return true;
      }else{
        return false;
      }
    }
    searchmode(1);
    searchout.style.display = 'none';
    wave_box.style.display = '';
    current_page = 1;

    document.getElementById('suggest').style.display = 'none';
    wave_box.innerHTML = ''//'<div class="wavelet" onclick="wave.robot.folderAction(\'markAsRead\', current_wave)">Mark wave as <b>Read</b> </div>';
    var header = document.createElement('div');
    header.className = 'wavelet';
    header.innerHTML = "<b>By </b> ";
    header.appendChild(userList(waveContent.data.waveletData.participants));
    
    wave_box.appendChild(header);

    current_wave = waveId = waveId.replace(/\s/,'');
    
    if(document.getElementById("chronos").checked){
      chronological_blip_render(wave_box)
    }else{
      recursive_blip_render(msg.data.waveletData.rootBlipId, wave_box);
    }
    var tags = document.createElement('div');
    var t = waveContent.data.waveletData.tags.join(', ');
    if(t.length == 0) t = "(None)";
    tags.innerHTML = "<b>Tags:</b> "+t; //todo: fix xss risk
    tags.className = 'tags';
    wave_box.appendChild(tags);
    
  });
})
      
}
function offline_search(callback){
  open_db();
  db.transaction(function (tx) {
    tx.executeSql('SELECT * FROM inbox', [], function (tx, results) {
		callback();
		var r = [];
        var shtml = '';
		for(var i = 0; i < results.rows.length; i++){
          var item = JSON.parse(results.rows.item(i).result);
          shtml += '<a href="#wave:'+item.waveId+'" class="searchlink '+searchStyle(item.waveId)+'" onclick=\'ch(this)\'><div class="search" id="'+item.waveId+'"><b>' + item.title+"</b> <span style='color:gray'>"+ item.snippet +"</div></a>";
        }
		
        searchout.innerHTML = shtml; 
    });
  })
}



function cache_cycle(){
  var citem = null;
  if(citem = cachequeue.shift()){
	console.log("caching wave" + citem.waveId);
    callbacks[wave.robot.fetchWave(citem.waveId, citem.waveId.replace(/w\+.+/g,'conv+root'))] = function(data){
	  console.log('acquired data for' + citem.waveId);
      db.transaction(function (tx) {
		console.log('fetched wave' + citem.waveId);
        tx.executeSql('CREATE TABLE IF NOT EXISTS inbox (waveid, result, data, date)');
        tx.executeSql('DELETE FROM inbox WHERE waveid = ?', [citem.waveId], function(tx, results){
          tx.executeSql('INSERT INTO inbox (waveid, result, data, date) VALUES (?, ?, ?, ?)', [citem.waveId, JSON.stringify(citem), JSON.stringify(data), new Date - 0], function(){
		  console.log("done caching wave" + citem.waveId);
            if(document.getElementById(citem.waveId))
				document.getElementById(citem.waveId).className = "search fresh_cache";
            cacheState[citem.waveId] = 2;
			var cs = [];
			for(var i in cacheState){
				cs.push(i);
			}
			localStorage.cacheState = JSON.stringify(cs);
      setTimeout(cache_cycle, 1000);
    });

        });
      });
	  return true;
    }
	runQueue();
  }
}

function resultClass(waveId){
	if(!cacheState[waveId]){
		return '';
	}else if(cacheState[waveId] == 1){
		return 'old_cache'
	}else if(cacheState[waveId] == 2){
		return 'fresh_cache';
	}
}
