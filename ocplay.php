<?
//print_r($_GET);
$path=$_GET['path'];
$file=$_GET['file'];
$no   =$_GET['no'];
//echo "path[$path]";
//echo '<br>';
//echo "file[$file]";
//echo '<br>';
//echo "d[$d]";
$path = str_replace('&', '\\&', $path);
$lfile = str_replace('&', '\\&', $file);
//$lfile = str_replace('#', '\\#', $file);

$now_timestamp = time();
//$file='';
//shell_exec("cp -r $src $dest");
if($file){ // 파일이 있으면 zip 파일 생성
    //echo 'create';
    //echo "cp $path$file* ocplay";
	// zip 파일 만들기 위한 파일 복사
    shell_exec("cp $path$lfile* ocplay");

    $batfile = fopen("ocplay/play.bat", "w") or die("Unable to open file!");
    //$txt = "OCPLAY ${file}.IMS\n";
    $txt = "cd ocplay\nmouseoff.com\nOCPLAY ${file}.IMS STANDARD.BNK\nhyunee";
    fwrite($batfile, $txt);
    fclose($batfile);
    //sleep(1);

//    shell_exec("rm zip/ocplay.zip -f");
    //shell_exec("zip -r zip/ocplay ocplay");
	// 이미 zip파일이 있으면 삭제
    shell_exec("rm zip/ocplay.$now_timestamp.zip -f");
	// 디렉토리 압축
    shell_exec("zip -r zip/ocplay.$now_timestamp.zip ocplay");
    //sleep(1);

	// zip 파일 만들기 위해 생성한 파일 삭제
    shell_exec("rm ocplay/play.bat ocplay/${file}* -f");
    echo 'ocplay.'.$now_timestamp;

	// 생성된 zip파일 3분뒤 삭제
    //shell_exec("echo 'rm /home/test/iss/zip/ocplay.$now_timestamp.zip -f' | at now + 3 minutes");
	//exec("echo 'rm zip/ocplay.$now_timestamp.zip -f' | at now + 3 minutes");
	
	// 스크립트 종료 시 실행될 삭제 작업 예약
	/*
	$temp_file = "zip/ocplay.$now_timestamp.zip";
	register_shutdown_function(function() use ($temp_file) {
		if (file_exists($temp_file)) {
			unlink($temp_file);
		}
	});
	*/
}

if($no){ // 번호가 있으면 zip 파일 삭제
    //echo 'erase';
    //echo $now_timestamp;

    shell_exec("rm zip/ocplay.$no.zip -f");
}
?>